require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const schedule = require('node-schedule');
const AIService = require('./ai');
const MovieFetcher = require('./movieFetcher');
const Pusher = require('./pusher');
const FeishuService = require('./feishuService');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const chatbot = new AIService();
const movieFetcher = new MovieFetcher();
const pusher = new Pusher({
  wecomWebhookUrl: process.env.WECOM_WEBHOOK_URL,
  dingtalkWebhookUrl: process.env.DINGTALK_WEBHOOK_URL,
  dingtalkSecret: process.env.DINGTALK_SECRET,
  pushTarget: process.env.PUSH_TARGET
});
const feishuService = new FeishuService(process.env.FEISHU_APP_ID, process.env.FEISHU_APP_SECRET);

// 推送历史存储 - 使用文件持久化
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'push-history.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.history || [];
    }
  } catch (error) {
    console.error('加载历史记录失败:', error.message);
  }
  return [];
}

function saveHistory(history) {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
      history: history,
      lastUpdate: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    console.error('保存历史记录失败:', error.message);
  }
}

let pushHistory = loadHistory();
let lastPushTime = pushHistory.length > 0 ? pushHistory[0].date : null;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function verifyDingtalkSign(timestamp, sign, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSign = encodeURIComponent(hmac.update(stringToSign).digest('base64'));
  return sign === expectedSign;
}

app.post('/api/webhook/dingtalk', async (req, res) => {
  try {
    const { timestamp, sign } = req.query;
    const secret = process.env.DINGTALK_SECRET;
    const msgtype = req.body.msgtype;
    
    if (secret && sign && !verifyDingtalkSign(timestamp, sign, secret)) {
      return res.status(401).send('签名验证失败');
    }

    if (msgtype === 'text') {
      const content = req.body.text.content;
      console.log(`📥 钉钉消息: ${content}`);

      if (content.includes('@电影推荐') || content.includes('@机器人')) {
        const question = content.replace(/@电影推荐|@机器人/g, '').trim();
        
        if (!question) {
          return res.json({ text: { content: '你好！我是电影推荐机器人，有什么可以帮你的吗？\n\n📌 指令示例：\n• 推荐一部科幻片\n• 类似《盗梦空间》的电影\n• 最近有什么热门电影？' } });
        }

        const response = await chatbot.handleMessage(question);
        return res.json({ text: { content: response } });
      }
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('钉钉消息处理失败:', error);
    res.status(500).send('服务器错误');
  }
});

app.post('/api/webhook/wecom', async (req, res) => {
  try {
    const { MsgType, Content, FromUserName } = req.body;
    
    console.log(`📥 企业微信消息: ${Content}`);

    if (MsgType === 'text') {
      if (Content.includes('@电影推荐') || Content.includes('@机器人')) {
        const question = Content.replace(/@电影推荐|@机器人/g, '').trim();
        
        if (!question) {
          return res.json({
            msgtype: 'text',
            text: {
              content: '你好！我是电影推荐机器人，有什么可以帮你的吗？\n\n📌 指令示例：\n• 推荐一部科幻片\n• 类似《盗梦空间》的电影\n• 最近有什么热门电影？'
            }
          });
        }

        const response = await chatbot.handleMessage(question);
        return res.json({
          msgtype: 'text',
          text: {
            content: response
          }
        });
      }
    }

    res.status(200).send('success');
  } catch (error) {
    console.error('企业微信消息处理失败:', error);
    res.status(500).send('服务器错误');
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '电影推荐机器人服务运行正常' });
});

// 电影数据缓存
let moviesCache = {
  today: null,
  all: null,
  lastUpdated: null
};

// 检查缓存是否有效（5分钟内）
function isCacheValid() {
  return moviesCache.lastUpdated && 
         Date.now() - moviesCache.lastUpdated < 5 * 60 * 1000;
}

// 更新缓存
async function updateCache() {
  try {
    const [todayMovies, allMovies] = await Promise.all([
      movieFetcher.fetchTopMovies(3),
      movieFetcher.fetchTopMovies(20)
    ]);
    moviesCache = {
      today: todayMovies,
      all: allMovies,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.warn('缓存更新失败，使用mock数据:', error.message);
    moviesCache = {
      today: movieFetcher.getMockMovies(3),
      all: movieFetcher.getMockMovies(20, true),
      lastUpdated: Date.now()
    };
  }
}

// 启动时立即用 mock 数据初始化缓存，避免首次请求等待 TMDB 超时
moviesCache = {
  today: movieFetcher.getMockMovies(3),
  all: movieFetcher.getMockMovies(20, true),
  lastUpdated: Date.now()
};
// 后台异步更新真实数据
updateCache();
// 定时更新缓存（每5分钟）
setInterval(updateCache, 5 * 60 * 1000);

// 获取今日推荐电影
app.get('/api/movies/today', (req, res) => {
  // 优先返回缓存
  if (moviesCache.today) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ movies: moviesCache.today, date: new Date().toISOString(), cached: true });
  } else {
    // 缓存未就绪，直接返回mock数据
    const mockMovies = movieFetcher.getMockMovies(3);
    res.json({ movies: mockMovies, date: new Date().toISOString(), cached: false });
  }
});

// 获取所有电影
app.get('/api/movies/all', (req, res) => {
  // 优先返回缓存
  if (moviesCache.all) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ movies: moviesCache.all, cached: true });
  } else {
    // 缓存未就绪，直接返回mock数据
    const mockMovies = movieFetcher.getMockMovies(20);
    res.json({ movies: mockMovies, cached: false });
  }
});

// 获取推送历史
app.get('/api/history', async (req, res) => {
  try {
    // 优先从文件获取历史记录
    const fileHistory = loadHistory();
    
    if (fileHistory.length > 0) {
      lastPushTime = fileHistory[0].date;
      res.json({ 
        history: fileHistory.slice(0, 50), 
        lastPushTime,
        source: 'file' 
      });
    } else if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
      // 如果文件为空且飞书已配置，从飞书获取
      const feishuHistory = await feishuService.getAllHistory();
      if (feishuHistory.length > 0) {
        lastPushTime = feishuHistory[0].date;
        saveHistory(feishuHistory);
        res.json({ 
          history: feishuHistory.slice(0, 50), 
          lastPushTime,
          source: 'feishu' 
        });
      } else {
        res.json({ 
          history: pushHistory.slice(-50), 
          lastPushTime,
          source: 'memory' 
        });
      }
    } else {
      res.json({ 
        history: pushHistory.slice(-50), 
        lastPushTime,
        source: 'memory' 
      });
    }
  } catch (error) {
    console.error('获取推送历史失败:', error.message);
    res.json({ 
      history: pushHistory.slice(-50), 
      lastPushTime,
      source: 'memory',
      error: error.message 
    });
  }
});

// 获取系统状态
app.get('/api/status', (req, res) => {
  res.json({
    isRunning: true,
    nextPushTime: process.env.SCHEDULE_TIME || '20:00',
    lastPushTime,
    totalPushes: pushHistory.length,
    pushTarget: process.env.PUSH_TARGET || 'all',
    movieCount: process.env.MOVIE_COUNT || 3
  });
});

// 清空飞书表格数据
app.post('/api/feishu/clear', async (req, res) => {
  try {
    if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
      return res.status(400).json({ success: false, message: '飞书未配置' });
    }
    
    const result = await feishuService.clearAllData();
    if (result) {
      res.json({ success: true, message: '清空成功' });
    } else {
      res.status(500).json({ success: false, message: '清空失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// 图片代理 - 解决跨域和ORB阻止问题
app.get('/api/image/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }
    
    // 根据目标域名选择合适的 Referer 和 headers
    let referer = '';
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
    
    if (url.includes('doubanio.com') || url.includes('douban.com')) {
      referer = 'https://movie.douban.com/';
    } else if (url.includes('media.themoviedb.org') || url.includes('image.tmdb.org') || url.includes('themoviedb.org') || url.includes('tmdb.org')) {
      referer = 'https://www.themoviedb.org/';
    } else if (url.includes('media-amazon.com') || url.includes('imdb.com')) {
      referer = 'https://www.imdb.com/';
    }
    
    if (referer) {
      headers['Referer'] = referer;
    }
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: headers,
      timeout: 15000
    });
    
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (error) {
    console.error('图片代理失败:', error.message);
    // 返回默认占位图
    const placeholder = generatePlaceholder();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(placeholder);
  }
});

// 生成SVG占位图
function generatePlaceholder(text = 'No Poster') {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
  <rect width="300" height="450" fill="#1e293b"/>
  <rect width="300" height="80" y="185" fill="#334155"/>
  <text x="150" y="225" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="14">${text}</text>
</svg>
  `.trim();
}

// 默认占位图端点
app.get('/api/image/placeholder', (req, res) => {
  const text = req.query.text || 'No Poster';
  const placeholder = generatePlaceholder(text);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(placeholder);
});

// ===== 海报管理 API =====

// 检查所有电影海报完整性
app.get('/api/posters/check', async (req, res) => {
  try {
    const movies = await movieFetcher.getMockMovies(20);
    const result = await movieFetcher.checkPosterIntegrity(movies);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 修复缺失的海报
app.post('/api/posters/fix', async (req, res) => {
  try {
    const movies = await movieFetcher.getMockMovies(20);
    const result = await movieFetcher.fixMissingPosters(movies);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 全量验证海报
app.get('/api/posters/verify', async (req, res) => {
  try {
    const movies = await movieFetcher.getMockMovies(20);
    const result = await movieFetcher.verifyAllPosters(movies);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新所有海报（定期刷新）
app.post('/api/posters/update', async (req, res) => {
  try {
    const movies = await movieFetcher.getMockMovies(20);
    const result = await movieFetcher.updateAllPosters(movies);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 确保所有海报完整（检查+修复）
app.post('/api/posters/ensure', async (req, res) => {
  try {
    const movies = await movieFetcher.getMockMovies(20);
    const result = await movieFetcher.ensureAllPosters(movies);
    
    res.json({
      success: result.failed === 0,
      data: result,
      message: result.failed === 0 ? '所有海报验证通过' : `仍有${result.failed}部电影海报无效`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取海报缓存状态
app.get('/api/posters/cache', async (req, res) => {
  try {
    const cachePath = path.join(__dirname, '../data/poster-cache.json');
    const backupPath = path.join(__dirname, '../data/poster-backup.json');
    
    const cacheData = fs.existsSync(cachePath) 
      ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) 
      : {};
    
    const backupData = fs.existsSync(backupPath) 
      ? JSON.parse(fs.readFileSync(backupPath, 'utf-8')) 
      : {};
    
    res.json({
      success: true,
      cacheCount: Object.keys(cacheData).length,
      backupCount: Object.keys(backupData).length,
      cacheSize: fs.existsSync(cachePath) ? fs.statSync(cachePath).size : 0,
      backupSize: fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 聊天接口
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    // 注入缓存电影数据，避免 chatbot 重复请求 TMDB（关键优化）
    if (moviesCache.all && moviesCache.all.length > 0) {
      chatbot.setCachedMovies(moviesCache.all);
    }

    const response = await chatbot.handleMessage(message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: '聊天处理失败' });
  }
});

// ========== 用户认证 API ==========

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveUsers(users) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 简单的 token 生成（生产环境应使用 JWT）
const userTokens = {};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 注册
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有字段' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于6位' });
    }
    
    const users = loadUsers();
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: '该用户名已被使用' });
    }
    
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      username,
      email,
      password, // 生产环境应使用 bcrypt
      createdAt: new Date().toISOString()
    };
    
    users.push(user);
    saveUsers(users);
    
    const token = generateToken();
    userTokens[token] = user.id;
    
    const { password: _, ...userData } = user;
    res.json({ success: true, user: userData, token });
  } catch (error) {
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ error: '请填写所有字段' });
    }
    
    const users = loadUsers();
    const user = users.find(
      u => (u.email === identifier || u.username === identifier) && u.password === password
    );
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = generateToken();
    userTokens[token] = user.id;
    
    const { password: _, ...userData } = user;
    res.json({ success: true, user: userData, token });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !userTokens[token]) {
      return res.status(401).json({ error: '未登录' });
    }
    
    const userId = userTokens[token];
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    const { password: _, ...userData } = user;
    res.json({ user: userData });
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// ========== 每晚20:00 定时推荐任务 ==========

const TODAY_RECOMMENDATION_FILE = path.join(__dirname, '..', 'data', 'today-recommendation.json');
const scheduleTime = process.env.SCHEDULE_TIME || '20:00';
const scheduleMovieCount = parseInt(process.env.MOVIE_COUNT) || 3;

// 读取今天的推荐结果
function getTodayRecommendation() {
  try {
    if (fs.existsSync(TODAY_RECOMMENDATION_FILE)) {
      const data = JSON.parse(fs.readFileSync(TODAY_RECOMMENDATION_FILE, 'utf-8'));
      const today = new Date().toISOString().substring(0, 10);
      if (data.date === today) return data;
    }
  } catch {}
  return null;
}

// 保存今天的推荐结果
function saveTodayRecommendation(recommendation) {
  const dir = path.dirname(TODAY_RECOMMENDATION_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  recommendation.savedAt = new Date().toISOString();
  fs.writeFileSync(TODAY_RECOMMENDATION_FILE, JSON.stringify(recommendation, null, 2));
}

// 执行每日推荐任务
async function executeDailyRecommendation() {
  console.log(`\n🚀 [${new Date().toLocaleString()}] 开始执行每日电影推荐任务...`);

  try {
    // 1. 获取电影数据（优先使用缓存）
    let movies;
    if (moviesCache.all && moviesCache.all.length > 0) {
      movies = moviesCache.all;
      console.log(`✅ 使用缓存数据（${movies.length}部）`);
    } else {
      movies = await movieFetcher.fetchTopMovies(scheduleMovieCount * 5);
    }

    if (movies.length === 0) {
      console.log('⚠️ 无电影数据，使用 mock 数据');
      movies = movieFetcher.getMockMovies(scheduleMovieCount * 5);
    }

    // 2. 从缓存中随机选择（避免重复）
    const shuffled = [...movies].sort(() => Math.random() - 0.5);
    const selectedMovies = shuffled.slice(0, scheduleMovieCount);

    // 3. 生成推荐文案
    const aiService = new AIService();
    let aiContent;
    try {
      console.log('🤖 调用 AI 生成推荐文案...');
      aiContent = await aiService.generateMovieRecommendation(selectedMovies);
    } catch {
      aiContent = `🎬 今日电影推荐\n\n${selectedMovies.map((m, i) =>
        `${i + 1}. 《${m.title}》 ⭐${m.rating}分\n   ${m.description || ''}\n   🔗 ${m.link}`
      ).join('\n\n')}`;
    }

    // 4. 推送到企业微信/钉钉
    const pushTargets = process.env.PUSH_TARGET === 'all' ? ['wecom', 'dingtalk'] : [process.env.PUSH_TARGET || 'wecom'];

    for (const target of pushTargets) {
      try {
        if (target === 'wecom' && process.env.WECOM_WEBHOOK_URL) {
          await pusher.pushToWecomText(aiContent);
          console.log('✅ 企业微信推送成功');
        } else if (target === 'dingtalk' && process.env.DINGTALK_WEBHOOK_URL) {
          await pusher.pushToDingtalkText(aiContent);
          console.log('✅ 钉钉推送成功');
        }
      } catch (err) {
        console.error(`❌ ${target}推送失败:`, err.message);
      }
    }

    // 5. 保存推荐结果（供前端展示）
    const recommendation = {
      date: new Date().toISOString().substring(0, 10),
      movies: selectedMovies,
      content: aiContent,
    };
    saveTodayRecommendation(recommendation);

    // 6. 保存到推送历史
    const historyRecord = {
      date: new Date().toISOString(),
      movies: selectedMovies.map(m => ({ title: m.title, rating: m.rating, link: m.link })),
      content: aiContent,
      targets: pushTargets,
    };
    pushHistory.unshift(historyRecord);
    if (pushHistory.length > 100) pushHistory.length = 100;
    saveHistory();

    console.log('🎉 每日电影推荐任务完成！');
  } catch (error) {
    console.error('❌ 每日推荐任务失败:', error.message);
  }
}

// 定时任务：每天 SCHEDULE_TIME 执行
const [scheduleHour, scheduleMinute] = scheduleTime.split(':');
console.log(`⏰ 定时推荐已设置：每天 ${scheduleHour}:${scheduleMinute}`);

schedule.scheduleJob({ hour: parseInt(scheduleHour), minute: parseInt(scheduleMinute) }, () => {
  executeDailyRecommendation();
});

// 提供今日推荐查询接口
app.get('/api/recommendations/today', (req, res) => {
  const rec = getTodayRecommendation();
  if (rec) {
    res.json(rec);
  } else {
    // 如果今天还没推送，返回缓存中的电影作为预览
    res.json({
      date: new Date().toISOString().substring(0, 10),
      movies: moviesCache.all?.slice(0, scheduleMovieCount) || [],
      content: null,
      pending: true,
      nextPushTime: `${scheduleHour}:${scheduleMinute}`,
    });
  }
});

// 手动触发推荐
app.post('/api/recommendations/trigger', async (req, res) => {
  res.json({ message: '正在执行每日推荐任务...' });
  executeDailyRecommendation().catch(console.error);
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║           🤖 电影推荐机器人 - Webhook服务                     ║
║                                                               ║
║  服务已启动，监听端口: ${PORT}                                 ║
║                                                               ║
║  Webhook地址:                                                 ║
║  • 钉钉: http://your-server-ip:${PORT}/api/webhook/dingtalk   ║
║  • 企业微信: http://your-server-ip:${PORT}/api/webhook/wecom  ║
║                                                               ║
║  支持的指令:                                                  ║
║  • @电影推荐 推荐一部科幻片                                    ║
║  • @电影推荐 类似《盗梦空间》的电影                             ║
║  • @电影推荐 本周热门电影                                      ║
║  • @电影推荐 评分最高的10部电影                                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;