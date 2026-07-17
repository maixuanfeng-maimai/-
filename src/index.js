require('dotenv').config();
const schedule = require('node-schedule');
const MovieFetcher = require('./movieFetcher');
const AIService = require('./ai');
const FeishuService = require('./feishuService');
const Pusher = require('./pusher');

class MovieRecommender {
  constructor() {
    this.movieFetcher = new MovieFetcher();
    this.aiService = new AIService();
    this.feishuService = new FeishuService(process.env.FEISHU_APP_ID, process.env.FEISHU_APP_SECRET);
    this.pusher = new Pusher({
      wecomWebhookUrl: process.env.WECOM_WEBHOOK_URL,
      dingtalkWebhookUrl: process.env.DINGTALK_WEBHOOK_URL,
      dingtalkSecret: process.env.DINGTALK_SECRET
    });
    
    this.scheduleTime = process.env.SCHEDULE_TIME || '09:00';
    this.movieCount = parseInt(process.env.MOVIE_COUNT) || 3;
    this.pushTarget = process.env.PUSH_TARGET || 'wecom';
    
    this.retryCount = 2;
    this.retryDelay = 60000;
  }

  async run() {
    console.log(`📅 每日电影推荐系统已启动`);
    console.log(`⏰ 定时推送时间：每天 ${this.scheduleTime}`);
    console.log(`🎯 推送目标：${this.pushTarget}`);
    console.log(`📽️ 推荐电影数量：${this.movieCount}`);
    console.log(`🔄 失败重试次数：${this.retryCount}次，间隔${this.retryDelay / 1000}秒`);
    
    this.scheduleJob();
    
    console.log('✅ 系统初始化完成，等待定时任务执行...');
  }

  scheduleJob() {
    const [hour, minute] = this.scheduleTime.split(':');
    
    schedule.scheduleJob({
      hour: parseInt(hour),
      minute: parseInt(minute)
    }, async () => {
      console.log(`\n🚀 开始执行定时任务 - ${new Date().toLocaleString()}`);
      await this.executeWithRetry();
    });
  }

  async executeWithRetry() {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryCount + 1; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 第${attempt}次重试 - ${new Date().toLocaleString()}`);
        }
        
        await this.executeRecommendation();
        
        if (attempt > 1) {
          console.log(`✅ 第${attempt}次重试成功！`);
        }
        return;
        
      } catch (error) {
        lastError = error;
        console.error(`❌ 第${attempt}次执行失败: ${error.message}`);
        
        if (attempt <= this.retryCount) {
          console.log(`⏳ 等待${this.retryDelay / 1000}秒后进行第${attempt + 1}次重试...`);
          await this.delay(this.retryDelay);
        }
      }
    }
    
    console.error('❌ 所有重试均失败，发送失败通知...');
    await this.sendFailureNotification(lastError);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeRecommendation() {
    let currentStep = '获取电影数据';
    
    try {
      console.log('🔍 正在获取电影数据...');
      const allMovies = await this.movieFetcher.fetchTopMovies(this.movieCount * 5);
      
      if (allMovies.length === 0) {
        throw new Error('未获取到电影数据');
      }
      
      currentStep = '查询飞书表格去重';
      console.log('🔄 正在检查已推荐的电影...');
      const recommendedMovies = await this.feishuService.getRecommendedMovies();
      
      const movies = [];
      const maxRetries = this.movieCount * 3;
      let attempts = 0;
      
      for (const movie of allMovies) {
        if (movies.length >= this.movieCount) break;
        if (attempts >= maxRetries) break;
        
        attempts++;
        const movieTitle = movie.title.toString().trim();
        
        if (recommendedMovies.includes(movieTitle)) {
          console.log(`⏭️ 跳过已推荐的电影: ${movieTitle}`);
          continue;
        }
        
        console.log(`✅ 选择新电影: ${movieTitle} (${movie.rating}分)`);
        movies.push(movie);
        recommendedMovies.push(movieTitle);
      }
      
      if (movies.length === 0) {
        console.log('⚠️ 所有电影都已推荐过，使用随机选择');
        movies.push(...allMovies.slice(0, this.movieCount));
      }
      
      console.log(`✅ 最终选择 ${movies.length} 部电影进行推荐`);
      
      currentStep = '生成推荐文案';
      console.log('🤖 正在调用AI生成推荐文案...');
      const aiContent = await this.aiService.generateMovieRecommendation(movies);
      console.log('\n📄 AI生成的推荐文案：\n', aiContent);
      
      currentStep = '推送企业微信';
      console.log('\n📤 开始推送...');
      await this.pushContent(movies, aiContent);
      
      currentStep = '保存飞书表格';
      console.log('\n📊 正在保存记录到飞书表格...');
      for (const movie of movies) {
        await this.feishuService.saveMovieRecord(movie, aiContent);
      }
      
      console.log('🎉 今日电影推荐推送完成！');
      
    } catch (error) {
      error.step = currentStep;
      throw error;
    }
  }

  async pushContent(movies, textContent) {
    const pushTargets = this.pushTarget === 'all' ? ['wecom', 'dingtalk'] : [this.pushTarget];
    
    for (const target of pushTargets) {
      console.log(`📤 推送到 ${target}...`);
      
      if (target === 'wecom') {
        if (process.env.WECOM_WEBHOOK_URL) {
          await this.pusher.pushToWecomText(textContent);
        } else {
          console.log('⚠️ 企业微信Webhook未配置，跳过推送');
        }
      } else if (target === 'dingtalk') {
        if (process.env.DINGTALK_WEBHOOK_URL) {
          await this.pusher.pushToDingtalkText(textContent);
        } else {
          console.log('⚠️ 钉钉Webhook未配置，跳过推送');
        }
      }
    }
  }

  async sendFailureNotification(error) {
    const failureTime = new Date().toLocaleString('zh-CN');
    const failedStep = error.step || '未知节点';
    const errorMessage = error.message || '未知错误';
    
    const notification = `
🚨 【每日电影推荐系统执行失败】

⏰ 失败时间：${failureTime}
📍 失败节点：${failedStep}
❌ 错误信息：${errorMessage}

系统已重试${this.retryCount}次，均未成功，请检查相关配置和网络状态。
    `.trim();
    
    try {
      await this.pusher.pushToWecomText(notification);
      console.log('✅ 失败通知已发送到企业微信');
    } catch (notifyError) {
      console.error('❌ 发送失败通知失败:', notifyError.message);
    }
  }

  async testRun() {
    console.log('🧪 执行测试运行...');
    await this.executeWithRetry();
  }
}

if (require.main === module) {
  const recommender = new MovieRecommender();
  
  if (process.argv.includes('--test')) {
    recommender.testRun();
  } else {
    recommender.run();
  }
}

module.exports = MovieRecommender;