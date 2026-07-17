const axios = require('axios');
const MovieFetcher = require('./movieFetcher');

class AIService {
  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
    this.deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V4-Pro';
    
    this.doubaoApiKey = process.env.DOUBAO_API_KEY;
    this.doubaoBaseUrl = 'https://api.doubao.com/api/text/v1/chat/completions';
    
    this.conversationHistory = [];
    this.movieFetcher = new MovieFetcher();
    this.cachedMovies = null;
    this.userPreferences = {
      favoriteGenres: [],
      favoriteMovies: [],
      ratingThreshold: 7.5
    };
  }

  setCachedMovies(movies) {
    this.cachedMovies = movies;
  }

  async getMovies(count = 20) {
    if (this.cachedMovies && this.cachedMovies.length > 0) {
      return this.cachedMovies.slice(0, count);
    }
    try {
      const result = await Promise.race([
        this.movieFetcher.fetchTopMovies(count),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      return result;
    } catch {
      return this.movieFetcher.getMockMovies(count);
    }
  }

  async generateMovieRecommendation(movies) {
    if (this.deepseekApiKey) {
      return await this.callDeepseek(movies);
    }
    
    if (this.doubaoApiKey) {
      return await this.callDoubao(movies);
    }
    
    return this.generateDefaultContent(movies);
  }

  async callDeepseek(movies) {
    try {
      const prompt = `
你是一位专业的电影推荐博主，擅长用轻松有趣的语言推荐好电影。
请从输入的电影列表中随机选择3部，生成一段适合在影迷社群分享的推荐文案。

严格按照以下格式输出：
🎬 今日电影推荐 🎬

1. 《{电影标题1}》
   ⭐ 评分：{评分1}分
   📅 上映：{上映年份1}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接1}

2. 《{电影标题2}》
   ⭐ 评分：{评分2}分
   📅 上映：{上映年份2}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接2}

3. 《{电影标题3}》
   ⭐ 评分：{评分3}分
   📅 上映：{上映年份3}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接3}

#今日电影推荐 #高分好片

电影列表：${JSON.stringify(movies)}
      `.trim();

      const response = await axios.post(
        this.deepseekApiUrl,
        {
          model: this.deepseekModel,
          messages: [
            {
              role: 'system',
              content: '你是一位专业的电影推荐博主，擅长用轻松有趣的语言推荐好电影。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('DeepSeek AI推荐文案生成成功');
        return response.data.choices[0].message.content;
      } else {
        console.log('DeepSeek API返回格式异常');
        return this.generateDefaultContent(movies);
      }
    } catch (error) {
      console.error('调用DeepSeek API失败:', error.message);
      return this.generateDefaultContent(movies);
    }
  }

  async callDoubao(movies) {
    try {
      const prompt = `
你是一位专业的电影推荐博主，擅长用轻松有趣的语言推荐好电影。
请从输入的电影列表中随机选择3部，生成一段适合在影迷社群分享的推荐文案。

严格按照以下格式输出：
🎬 今日电影推荐 🎬

1. 《{电影标题1}》
   ⭐ 评分：{评分1}分
   📅 上映：{上映年份1}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接1}

2. 《{电影标题2}》
   ⭐ 评分：{评分2}分
   📅 上映：{上映年份2}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接2}

3. 《{电影标题3}》
   ⭐ 评分：{评分3}分
   📅 上映：{上映年份3}年
   📝 简介：{30-50字剧情简介，绝对不能剧透结局}
   🔗 查看详情：{链接3}

#今日电影推荐 #高分好片

电影列表：${JSON.stringify(movies)}
      `.trim();

      const response = await axios.post(
        this.doubaoBaseUrl,
        {
          model: 'Doubao-3.5',
          messages: [
            {
              role: 'system',
              content: '你是一位专业的电影推荐博主，擅长用轻松有趣的语言推荐好电影。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.doubaoApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('豆包AI推荐文案生成成功');
        return response.data.choices[0].message.content;
      } else {
        console.log('豆包API返回格式异常');
        return this.generateDefaultContent(movies);
      }
    } catch (error) {
      console.error('调用豆包API失败:', error.message);
      return this.generateDefaultContent(movies);
    }
  }

  generateDefaultContent(movies) {
    const displayMovies = movies.slice(0, 3);
    
    const intros = [
      '这是一部让人回味无穷的经典之作，剧情扎实，人物鲜明，值得细细品味！',
      '精彩的故事配上出色的表演，节奏把控恰到好处，绝对不容错过！',
      '画面精美，叙事流畅，情感真挚，是一部能打动人心的佳作！',
      '情节跌宕起伏，充满悬念，每个角色都刻画得入木三分！',
      '独特的视角，深刻的主题，看完让人久久不能释怀！'
    ];
    
    let content = '🎬 今日电影推荐 🎬\n\n';
    
    displayMovies.forEach((movie, index) => {
      const rating = parseFloat(movie.rating).toFixed(1);
      const releaseDate = movie.release_date || '2024-01-01';
      const year = releaseDate.substring(0, 4);
      const intro = intros[Math.floor(Math.random() * intros.length)];
      
      content += `${index + 1}. 《${movie.title}》\n`;
      content += `   ⭐ 评分：${rating}分\n`;
      content += `   📅 上映：${year}年\n`;
      content += `   📝 简介：${intro}\n`;
      content += `   🔗 查看详情：${movie.link}\n\n`;
    });
    
    content += '#今日电影推荐 #高分好片';
    
    return content;
  }

  async callAI(userMessage, systemPrompt, useHistory = false) {
    if (this.deepseekApiKey) {
      return await this._callDeepseekWithPrompt(userMessage, systemPrompt, useHistory);
    }
    
    if (this.doubaoApiKey) {
      return await this._callDoubaoWithPrompt(userMessage, systemPrompt, useHistory);
    }
    
    return this.generateDefaultAnalysis(userMessage);
  }

  async _callDeepseekWithPrompt(userMessage, systemPrompt, useHistory) {
    try {
      const messages = [{
        role: 'system',
        content: systemPrompt
      }];

      if (useHistory && this.conversationHistory.length > 0) {
        messages.push(...this.conversationHistory);
      }

      messages.push({
        role: 'user',
        content: userMessage
      });

      const response = await axios.post(
        this.deepseekApiUrl,
        {
          model: this.deepseekModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 3000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.deepseekApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('DeepSeek AI调用成功');
        return response.data.choices[0].message.content;
      } else {
        console.log('DeepSeek API返回格式异常');
        return this.generateDefaultAnalysis(userMessage);
      }
    } catch (error) {
      console.error('调用DeepSeek API失败:', error.message);
      return this.generateDefaultAnalysis(userMessage);
    }
  }

  async _callDoubaoWithPrompt(userMessage, systemPrompt, useHistory) {
    try {
      const messages = [{
        role: 'system',
        content: systemPrompt
      }];

      if (useHistory && this.conversationHistory.length > 0) {
        messages.push(...this.conversationHistory);
      }

      messages.push({
        role: 'user',
        content: userMessage
      });

      const response = await axios.post(
        this.doubaoBaseUrl,
        {
          model: 'Doubao-3.5',
          messages: messages,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.doubaoApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('豆包AI调用成功');
        return response.data.choices[0].message.content;
      } else {
        console.log('豆包API返回格式异常');
        return this.generateDefaultAnalysis(userMessage);
      }
    } catch (error) {
      console.error('调用豆包API失败:', error.message);
      return this.generateDefaultAnalysis(userMessage);
    }
  }

  generateDefaultAnalysis(message) {
    if (message.includes('类似') || message.includes('推荐')) {
      return `🎬 推荐结果：\n\n1. 《星际穿越》\n   📅 上映年份：2014年\n   📝 剧情简介：未来地球环境恶化，宇航员穿越虫洞寻找新家园，探讨爱与时间的关系。\n   💡 推荐理由：同样涉及高概念科幻和复杂叙事结构\n\n2. 《源代码》\n   📅 上映年份：2011年\n   📝 剧情简介：士兵通过特殊技术反复回到爆炸前的8分钟，试图阻止恐怖袭击。\n   💡 推荐理由：时间循环设定，层层递进的悬疑感\n\n3. 《记忆碎片》\n   📅 上映年份：2000年\n   📝 剧情简介：患有短期失忆症的男子依靠纹身和照片寻找杀妻凶手。\n   💡 推荐理由：非线性叙事，考验观众逻辑推理能力\n\n#电影推荐 #烧脑片`;
    }
    
    return '🎬 电影分析功能需要配置AI API Key才能使用完整功能。\n\n如需获取更多电影推荐和分析，请配置DeepSeek或豆包API Key。';
  }

  async handleMessage(message) {
    this.conversationHistory.push({ role: 'user', content: message });

    const intent = this.detectIntent(message);
    let response;

    switch (intent.type) {
      case 'hello':
        response = this.getGreeting();
        break;
      case 'help':
        response = this.getHelp();
        break;
      case 'preference':
        response = this.updatePreferences(intent);
        break;
      case 'recommend':
      case 'search':
      case 'general':
      default:
        response = await this.smartReply(message, intent);
        break;
    }

    this.conversationHistory.push({ role: 'assistant', content: response });
    return response;
  }

  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (/^你好|^嗨|^hello|^hi|^在吗|^早|早上好|晚上好/.test(lowerMessage.trim())) {
      return { type: 'hello' };
    }

    if (lowerMessage.includes('帮助') || lowerMessage.includes('help') || lowerMessage.includes('怎么用') || lowerMessage.includes('功能')) {
      return { type: 'help' };
    }

    if (lowerMessage.includes('我喜欢') || lowerMessage.includes('偏好') || lowerMessage.includes('我爱看')) {
      return { type: 'preference', data: { message } };
    }

    const keywordMatch = this.extractRecommendKeywords(lowerMessage);
    return { type: 'recommend', data: { message, keywords: keywordMatch } };
  }

  extractRecommendKeywords(lowerMessage) {
    const keywords = [];
    const keywordMap = [
      ['科幻', '科幻片', 'sci-fi', 'science fiction'],
      ['动作', '动作片', 'action'],
      ['喜剧', '喜剧片', '搞笑', 'comedy', 'funny'],
      ['动画', '动画片', '动漫', 'animation', 'anime', '宫崎骏'],
      ['爱情', '爱情片', '恋爱', 'romance', 'romantic'],
      ['悬疑', '悬疑片', '惊悚', '推理', 'thriller', 'mystery'],
      ['治愈', '温暖', '感动', '温情', 'healing', 'warm'],
      ['烧脑', '悬疑', '反转', '复杂', 'mind-bending'],
      ['经典', '必看', '神作', 'classic'],
      ['励志', '成长', '鼓舞', 'inspirational'],
    ];

    for (const [primary, ...aliases] of keywordMap) {
      if (aliases.some(k => lowerMessage.includes(k))) {
        keywords.push(primary);
      }
    }

    const ratingMatch = lowerMessage.match(/(\d+(\.\d+)?)\s*分/);
    if (ratingMatch) {
      keywords.push(`评分≥${ratingMatch[1]}分`);
    }

    const yearMatch = lowerMessage.match(/(\d{4})\s*年/);
    if (yearMatch) {
      keywords.push(`${yearMatch[1]}年`);
    }

    return [...new Set(keywords)];
  }

  async smartReply(message, intent) {
    const movies = await this.getMovies(20);

    const movieCatalog = movies.map((m, i) => {
      const year = m.release_date ? m.release_date.substring(0, 4) : '未知';
      const genres = (m.genre_ids || [])
        .map(gid => {
          const map = { 28: '动作', 12: '冒险', 16: '动画', 35: '喜剧', 80: '犯罪', 18: '剧情',
            14: '奇幻', 27: '恐怖', 10402: '音乐', 9648: '悬疑', 10749: '爱情', 878: '科幻',
            53: '惊悚', 10752: '战争', 36: '历史', 10751: '家庭', 99: '纪录' };
          return map[gid];
        })
        .filter(Boolean)
        .join('/');

      return `${i + 1}.《${m.title}》(⭐${m.rating} | ${year}${genres ? ' | ' + genres : ''}) - ${(m.description || '').substring(0, 80)}`;
    }).join('\n');

    let preferenceContext = '';
    if (this.userPreferences.favoriteGenres.length > 0) {
      preferenceContext = `\n用户偏好类型：${this.userPreferences.favoriteGenres.join('、')}`;
    }
    if (this.userPreferences.favoriteMovies.length > 0) {
      preferenceContext += `\n用户喜欢的电影：${this.userPreferences.favoriteMovies.join('、')}`;
    }

    const recentHistory = this.conversationHistory.slice(-6)
      .map(h => `${h.role === 'user' ? '用户' : '助手'}：${h.content}`)
      .join('\n');

    const systemPrompt = `你是一个睿智、风趣、有品位的电影推荐助手，名叫「电影推荐官」。你的特点：
- 每次推荐都会解释推荐理由，让人觉得你在认真思考
- 会根据用户的口味和心情推荐，不是随便丢片名
- 语言风格：温暖自然，像朋友聊天，偶尔幽默，不要机器人腔
- 如果用户没有明确需求，主动问一两句了解ta的喜好

当前可推荐的电影库（共${movies.length}部）：
${movieCatalog}${preferenceContext}

重要规则：
1. 只能从以上电影库中推荐，不要编造电影
2. 每次推荐 2-5 部，每部都要写推荐理由
3. 如果用户想看库里没有的类型，诚实告知并推荐接近的
4. 回复末尾附上推荐电影的豆瓣链接`;

    const userPrompt = `${
      intent.type === 'recommend' && intent.data.keywords.length > 0
        ? `用户想找：${intent.data.keywords.join('、')}类型的电影`
        : ''
    }
${recentHistory ? `最近对话：\n${recentHistory}\n\n` : ''}
用户最新问题：${message}

请认真思考后回复。`;

    try {
      return await this._callDeepseekWithPrompt(userPrompt, systemPrompt);
    } catch {
      return this.generateFallbackReply(message, movies);
    }
  }

  generateFallbackReply(message, movies) {
    const lowerMessage = message.toLowerCase();
    let matchedMovies = movies;

    const genreKeywords = {
      '科幻': [878], '动作': [28], '喜剧': [35], '动画': [16],
      '爱情': [10749], '悬疑': [53, 9648], '惊悚': [53]
    };

    for (const [genre, ids] of Object.entries(genreKeywords)) {
      if (lowerMessage.includes(genre)) {
        matchedMovies = movies.filter(m => m.genre_ids?.some(id => ids.includes(id)));
        break;
      }
    }

    if (lowerMessage.includes('高分') || lowerMessage.includes('评分高')) {
      matchedMovies = [...matchedMovies].sort((a, b) => b.rating - a.rating);
    }

    const selected = matchedMovies.slice(0, 5);
    if (selected.length === 0) {
      return '抱歉，我没能从当前电影库中找到特别匹配的电影。换个说法试试？比如「推荐科幻片」「有什么治愈的电影」～';
    }

    let reply = '🤖 AI 暂不可用，为你从库中精选了几部：\n\n';
    selected.forEach((m, i) => {
      const year = m.release_date ? m.release_date.substring(0, 4) : '';
      reply += `${i + 1}. 《${m.title}》 ⭐${m.rating} ${year ? '| ' + year : ''}\n`;
      reply += `   ${m.description || ''}\n`;
      reply += `   🔗 ${m.link}\n\n`;
    });

    return reply;
  }

  updatePreferences(intent) {
    const message = intent.data.message;
    const genres = ['科幻', '动作', '喜剧', '动画', '爱情', '悬疑', '治愈', '烧脑', '励志'];
    
    genres.forEach(g => {
      if (message.includes(g) && !this.userPreferences.favoriteGenres.includes(g)) {
        this.userPreferences.favoriteGenres.push(g);
      }
    });

    const match = message.match(/《(.+?)》/);
    if (match && !this.userPreferences.favoriteMovies.includes(match[1])) {
      this.userPreferences.favoriteMovies.push(match[1]);
    }

    let response = '✅ 已记住你的偏好！\n';
    if (this.userPreferences.favoriteGenres.length > 0) {
      response += `🎭 喜欢：${this.userPreferences.favoriteGenres.join('、')}\n`;
    }
    if (this.userPreferences.favoriteMovies.length > 0) {
      response += `🎬 喜欢电影：${this.userPreferences.favoriteMovies.join('、')}\n`;
    }
    response += '\n试试说「推荐一部」来获取为你量身定制的推荐！';

    return response;
  }

  getGreeting() {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

    return `${timeGreeting}！我是你的电影推荐官 🎬\n\n` +
      `无论你想找什么类型的电影，告诉我你的心情或偏好，我来帮你挑～\n\n` +
      `试试问我：\n` +
      `• 「想看烧脑的科幻片」\n` +
      `• 「有没有治愈温暖的电影」\n` +
      `• 「推荐几部豆瓣9分以上的经典」\n` +
      `• 「我心情不好，推荐一部暖心的」\n\n` +
      `你随便说，我会认真帮你找的！`;
  }

  getHelp() {
    return `🎬 电影推荐官 - 使用指南\n\n` +
      `💬 像朋友聊天一样和我说就行！\n\n` +
      `📌 你可以这样问：\n` +
      `• 「推荐一部好看的科幻片」\n` +
      `• 「有没有类似《盗梦空间》的烧脑片」\n` +
      `• 「豆瓣9分以上的经典电影」\n` +
      `• 「最近心情不好，推荐轻松搞笑的」\n` +
      `• 「我爱看悬疑推理的」\n\n` +
      `🤖 我会仔细思考你的需求，从电影库中精选推荐，并告诉你推荐理由！`;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async ask(message) {
    return await this.handleMessage(message);
  }
}

module.exports = AIService;