require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PosterManager {
  constructor() {
    this.tmdbApiKey = process.env.TMDB_API_KEY || '80f1f42952113240211ec616ab4065c5';
    this.tmdbBaseUrl = 'https://api.themoviedb.org/3';
    this.tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w500';
    this.posterCachePath = path.join(__dirname, '../data/poster-cache.json');
    this.posterBackupPath = path.join(__dirname, '../data/poster-backup.json');
    this.maxRetryCount = 3;
    this.retryDelay = 2000;
    this.cacheValidityDays = 7;
    
    this.init();
  }

  init() {
    if (!fs.existsSync(path.dirname(this.posterCachePath))) {
      fs.mkdirSync(path.dirname(this.posterCachePath), { recursive: true });
    }
    
    if (!fs.existsSync(this.posterCachePath)) {
      fs.writeFileSync(this.posterCachePath, JSON.stringify({}));
    }
    
    if (!fs.existsSync(this.posterBackupPath)) {
      fs.writeFileSync(this.posterBackupPath, JSON.stringify({}));
    }
  }

  async getCache() {
    try {
      const data = fs.readFileSync(this.posterCachePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveCache(cache) {
    try {
      fs.writeFileSync(this.posterCachePath, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('保存海报缓存失败:', error.message);
    }
  }

  async backupPoster(movieId, posterUrl) {
    try {
      const backup = JSON.parse(fs.readFileSync(this.posterBackupPath, 'utf-8'));
      backup[movieId] = {
        posterUrl,
        backupTime: new Date().toISOString(),
        verified: true
      };
      fs.writeFileSync(this.posterBackupPath, JSON.stringify(backup, null, 2));
    } catch (error) {
      console.error('备份海报失败:', error.message);
    }
  }

  async verifyPosterUrl(url) {
    if (!url) {
      return false;
    }
    
    if (url.startsWith('data:image/svg+xml') || url.startsWith('data:image/')) {
      return true;
    }
    
    if (!url.startsWith('http')) {
      return false;
    }
    
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        headers: { 'Referer': 'https://www.themoviedb.org/' }
      });
      
      const contentType = response.headers['content-type'] || '';
      return contentType.startsWith('image/');
    } catch {
      return false;
    }
  }

  async fetchPosterFromTMDB(movieId) {
    try {
      const response = await axios.get(`${this.tmdbBaseUrl}/movie/${movieId}`, {
        params: { api_key: this.tmdbApiKey, language: 'zh-CN' },
        timeout: 8000
      });
      
      const movie = response.data;
      if (movie.poster_path) {
        const posterUrl = `${this.tmdbImageBaseUrl}${movie.poster_path}`;
        if (await this.verifyPosterUrl(posterUrl)) {
          await this.backupPoster(movieId, posterUrl);
          return posterUrl;
        }
      }
    } catch (error) {
      console.warn(`从TMDB获取海报失败 (ID: ${movieId}):`, error.message);
    }
    return null;
  }

  async fetchPosterFromTMDBByTitle(title, year = null) {
    try {
      const params = {
        api_key: this.tmdbApiKey,
        query: title,
        language: 'zh-CN'
      };
      
      if (year) {
        params.year = year;
      }
      
      const response = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
        params,
        timeout: 8000
      });
      
      const results = response.data.results;
      if (results && results.length > 0) {
        const bestMatch = results[0];
        if (bestMatch.poster_path) {
          const posterUrl = `${this.tmdbImageBaseUrl}${bestMatch.poster_path}`;
          if (await this.verifyPosterUrl(posterUrl)) {
            await this.backupPoster(bestMatch.id, posterUrl);
            return { posterUrl, movieId: bestMatch.id };
          }
        }
      }
    } catch (error) {
      console.warn(`通过标题搜索海报失败 (标题: ${title}):`, error.message);
    }
    return null;
  }

  generateDefaultPoster(movie) {
    const title = movie.title || '电影';
    const rating = (movie.rating || movie.vote_average || 0).toFixed(1);
    const year = movie.release_date?.substring(0, 4) || '????';
    
    const themes = {
      18: ['#0f1a2e', '#60a5fa'],
      28: ['#1a1a2e', '#e94560'],
      12: ['#002010', '#34d399'],
      16: ['#1a0030', '#a855f7'],
      35: ['#1a2000', '#f0a500'],
      80: ['#1a1000', '#f59e0b'],
      53: ['#1a0000', '#ef4444'],
      99: ['#101010', '#a3a3a3'],
      18: ['#0f1a2e', '#60a5fa'],
      10751: ['#0a1a0a', '#34d399'],
      14: ['#1a0050', '#c084fc'],
      36: ['#1a1200', '#d4a574'],
      27: ['#1a0000', '#ef4444'],
      10402: ['#001030', '#818cf8'],
      9648: ['#1a0000', '#ef4444'],
      10749: ['#2e0a1a', '#f472b6'],
      878: ['#0a1628', '#00d4ff'],
      10770: ['#1a1200', '#d4a574'],
      10752: ['#1a0a00', '#f87171'],
      37: ['#1a1200', '#d97706']
    };
    
    const genreId = movie.genre_ids?.[0] || 18;
    const [bgColor, accentColor] = themes[genreId] || ['#1a1a2e', '#f0a500'];
    
    const shortTitle = title.length > 8 ? title.substring(0, 7) + '…' : title;
    const stars = Math.round(parseFloat(rating) || 0);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="562" viewBox="0 0 380 562">
  <defs>
    <linearGradient id="bgGradient" x1="0" y1="0" x2="380" y2="562">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="#0a0a14"/>
    </linearGradient>
    <linearGradient id="accentGradient" x1="0" y1="0" x2="380" y2="0">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${accentColor}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="380" height="562" fill="url(#bgGradient)"/>
  <rect width="380" height="4" fill="url(#accentGradient)"/>
  <circle cx="190" cy="220" r="75" fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.15"/>
  <circle cx="190" cy="220" r="55" fill="${accentColor}" opacity="0.06"/>
  <polygon points="172,198 172,242 215,220" fill="${accentColor}" opacity="0.5"/>
  <text x="190" y="350" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="22" font-weight="bold">${shortTitle}</text>
  <text x="190" y="390" text-anchor="middle" fill="${accentColor}" font-family="Arial,sans-serif" font-size="26" font-weight="bold">${'★'.repeat(Math.min(stars, 5))}</text>
  <text x="190" y="413" text-anchor="middle" fill="${accentColor}" font-family="Arial,sans-serif" font-size="14">${rating}</text>
  <text x="190" y="440" text-anchor="middle" fill="#777" font-family="Arial,sans-serif" font-size="12">${year}</text>
  <rect y="558" width="380" height="4" fill="url(#accentGradient)"/>
  <text x="190" y="550" text-anchor="middle" fill="${accentColor}" opacity="0.25" font-family="Arial,sans-serif" font-size="10">🎬 每日电影推荐</text>
</svg>`;
    
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  async getPosterWithRetry(movieId, options = {}) {
    const { title, year } = options;
    let posterUrl = null;
    let attempts = 0;
    
    while (attempts < this.maxRetryCount && !posterUrl) {
      attempts++;
      
      posterUrl = await this.fetchPosterFromTMDB(movieId);
      
      if (!posterUrl && title) {
        const result = await this.fetchPosterFromTMDBByTitle(title, year);
        if (result) {
          posterUrl = result.posterUrl;
        }
      }
      
      if (!posterUrl && attempts < this.maxRetryCount) {
        console.log(`海报获取重试中 (ID: ${movieId}, 尝试: ${attempts})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
      }
    }
    
    return posterUrl;
  }

  async checkPosterIntegrity(movies) {
    const results = {
      total: movies.length,
      valid: 0,
      missing: 0,
      invalid: 0,
      verified: [],
      issues: []
    };
    
    for (const movie of movies) {
      const result = await this.checkSinglePoster(movie);
      
      if (result.status === 'valid') {
        results.valid++;
        results.verified.push({
          movieId: movie.id,
          title: movie.title,
          posterUrl: movie.image,
          verifiedAt: new Date().toISOString()
        });
      } else if (result.status === 'missing') {
        results.missing++;
        results.issues.push({
          type: 'missing',
          movieId: movie.id,
          title: movie.title,
          currentPoster: movie.image,
          message: result.message
        });
      } else {
        results.invalid++;
        results.issues.push({
          type: 'invalid',
          movieId: movie.id,
          title: movie.title,
          currentPoster: movie.image,
          message: result.message
        });
      }
    }
    
    console.log(`\n=== 海报完整性检查报告 ===`);
    console.log(`总电影数: ${results.total}`);
    console.log(`有效海报: ${results.valid}`);
    console.log(`缺失海报: ${results.missing}`);
    console.log(`无效海报: ${results.invalid}`);
    
    if (results.issues.length > 0) {
      console.log(`\n问题详情:`);
      results.issues.forEach(issue => {
        console.log(`  - [${issue.type}] ${issue.title} (ID: ${issue.movieId}): ${issue.message}`);
      });
    }
    
    return results;
  }

  async checkSinglePoster(movie) {
    if (!movie.image || typeof movie.image !== 'string' || movie.image.trim() === '') {
      return { status: 'missing', message: '海报URL缺失或无效' };
    }
    
    if (movie.image.startsWith('data:image/')) {
      return { status: 'valid', message: '海报验证通过（内置图片）' };
    }
    
    if (!movie.image.startsWith('http')) {
      return { status: 'missing', message: '海报URL格式无效' };
    }
    
    const isValid = await this.verifyPosterUrl(movie.image);
    
    if (!isValid) {
      return { status: 'invalid', message: '海报URL无法访问或非图片类型' };
    }
    
    return { status: 'valid', message: '海报验证通过' };
  }

  async fixMissingPosters(movies) {
    const results = {
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    const integrityResults = await this.checkPosterIntegrity(movies);
    
    for (const issue of integrityResults.issues) {
      results.total++;
      
      const movie = movies.find(m => m.id === issue.movieId);
      if (!movie) {
        results.skipped++;
        continue;
      }
      
      console.log(`正在修复海报: ${movie.title} (ID: ${movie.id})`);
      
      const newPoster = await this.getPosterWithRetry(movie.id, {
        title: movie.title,
        year: movie.release_date?.substring(0, 4)
      });
      
      if (newPoster) {
        movie.image = newPoster;
        await this.backupPoster(movie.id, newPoster);
        results.fixed++;
        results.details.push({
          movieId: movie.id,
          title: movie.title,
          oldPoster: issue.currentPoster,
          newPoster: newPoster,
          status: 'fixed'
        });
        console.log(`  ✓ 海报修复成功: ${movie.title}`);
      } else {
        movie.image = this.generateDefaultPoster(movie);
        results.failed++;
        results.details.push({
          movieId: movie.id,
          title: movie.title,
          oldPoster: issue.currentPoster,
          newPoster: 'default-svg',
          status: 'default'
        });
        console.log(`  ⚠ 使用默认海报: ${movie.title}`);
      }
    }
    
    console.log(`\n=== 海报修复报告 ===`);
    console.log(`处理总数: ${results.total}`);
    console.log(`修复成功: ${results.fixed}`);
    console.log(`使用默认: ${results.failed}`);
    console.log(`跳过: ${results.skipped}`);
    
    return results;
  }

  async updateAllPosters(movies) {
    console.log('\n=== 开始更新所有电影海报 ===');
    
    const results = {
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    for (const movie of movies) {
      try {
        const cache = await this.getCache();
        const cachedPoster = cache[movie.id];
        
        if (cachedPoster && this.isCacheValid(cachedPoster)) {
          results.skipped++;
          continue;
        }
        
        const newPoster = await this.getPosterWithRetry(movie.id, {
          title: movie.title,
          year: movie.release_date?.substring(0, 4)
        });
        
        if (newPoster && newPoster !== movie.image) {
          movie.image = newPoster;
          cache[movie.id] = {
            posterUrl: newPoster,
            cachedAt: new Date().toISOString(),
            movieId: movie.id,
            title: movie.title
          };
          await this.saveCache(cache);
          await this.backupPoster(movie.id, newPoster);
          results.updated++;
          console.log(`更新海报: ${movie.title}`);
        }
      } catch (error) {
        results.errors++;
        console.error(`更新海报失败 ${movie.title}:`, error.message);
      }
    }
    
    console.log(`\n=== 海报更新报告 ===`);
    console.log(`更新成功: ${results.updated}`);
    console.log(`跳过(缓存有效): ${results.skipped}`);
    console.log(`更新失败: ${results.errors}`);
    
    return results;
  }

  isCacheValid(cachedEntry) {
    if (!cachedEntry || !cachedEntry.cachedAt) {
      return false;
    }
    
    const cachedDate = new Date(cachedEntry.cachedAt);
    const now = new Date();
    const diffDays = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays < this.cacheValidityDays;
  }

  async verifyAllPosters(movies) {
    console.log('\n=== 全量海报验证 ===');
    
    let verifiedCount = 0;
    let failedCount = 0;
    const failedMovies = [];
    
    for (const movie of movies) {
      const result = await this.checkSinglePoster(movie);
      
      if (result.status === 'valid') {
        verifiedCount++;
      } else {
        failedCount++;
        failedMovies.push({
          id: movie.id,
          title: movie.title,
          currentPoster: movie.image,
          reason: result.message
        });
      }
    }
    
    console.log(`验证结果: ${verifiedCount}/${movies.length} 有效`);
    
    if (failedCount > 0) {
      console.log(`\n验证失败的电影:`);
      failedMovies.forEach(movie => {
        console.log(`  - ${movie.title} (ID: ${movie.id}): ${movie.reason}`);
      });
    }
    
    return {
      total: movies.length,
      verified: verifiedCount,
      failed: failedCount,
      failedMovies
    };
  }
}

module.exports = PosterManager;