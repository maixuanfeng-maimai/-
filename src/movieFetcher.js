require('dotenv').config();
const axios = require('axios');
const PosterManager = require('./posterManager');

class MovieFetcher {
  constructor() {
    this.tmdbApiKey = process.env.TMDB_API_KEY || '80f1f42952113240211ec616ab4065c5';
    this.tmdbBaseUrl = 'https://api.themoviedb.org/3';
    this.posterManager = new PosterManager();
  }

  validateMovieData(movie) {
    const errors = [];
    
    if (!movie.id || typeof movie.id !== 'number') {
      errors.push(`电影ID无效: ${movie.title || '未知'}`);
    }
    
    if (!movie.title || typeof movie.title !== 'string' || movie.title.trim() === '') {
      errors.push(`电影名称无效: ID=${movie.id}`);
    }
    
    if (!movie.image || typeof movie.image !== 'string' || movie.image.trim() === '') {
      errors.push(`电影海报URL缺失: ${movie.title || '未知'} (ID=${movie.id})`);
    } else if (!movie.image.startsWith('http://') && !movie.image.startsWith('https://') && !movie.image.startsWith('data:image/')) {
      errors.push(`电影海报URL格式无效: ${movie.title || '未知'} (ID=${movie.id}) - URL=${movie.image}`);
    }
    
    if (errors.length > 0) {
      console.warn('电影数据校验警告:', errors);
    }
    
    return errors.length === 0;
  }

  validateAllMovies(movies) {
    let validCount = 0;
    let invalidCount = 0;
    
    movies.forEach(movie => {
      if (this.validateMovieData(movie)) {
        validCount++;
      } else {
        invalidCount++;
      }
    });
    
    console.log(`电影数据校验完成: 有效 ${validCount} 部, 无效 ${invalidCount} 部`);
    
    return movies.filter(movie => {
      const isValid = this.validateMovieData(movie);
      if (!isValid) {
        console.warn('过滤无效电影:', movie.title || movie.id);
      }
      return isValid;
    });
  }

  async fetchTopMovies(count = 20) {
    try {
      const response = await axios.get(`${this.tmdbBaseUrl}/movie/top_rated`, {
        params: { api_key: this.tmdbApiKey, language: 'zh-CN', page: 1 },
        timeout: 8000
      });

      let movies = response.data.results.slice(0, count).map(movie => ({
        title: movie.title,
        rating: parseFloat((movie.vote_average || 0).toFixed(1)),
        vote_count: movie.vote_count,
        link: `https://movie.douban.com/subject_search?search_text=${encodeURIComponent(movie.title)}`,
        image: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '',
        description: movie.overview || '暂无简介',
        release_date: movie.release_date,
        id: movie.id,
        original_title: movie.original_title,
        genre_ids: movie.genre_ids || []
      }));

      movies = this.validateAllMovies(movies);
      
      return movies;
    } catch (error) {
      console.error('获取电影数据失败:', error.message);
      return this.getMockMovies(count);
    }
  }

  async fetchMovieDetail(movieId) {
    try {
      const [movieRes, creditsRes] = await Promise.all([
        axios.get(`${this.tmdbBaseUrl}/movie/${movieId}`, {
          params: { api_key: this.tmdbApiKey, language: 'zh-CN' },
          timeout: 8000
        }),
        axios.get(`${this.tmdbBaseUrl}/movie/${movieId}/credits`, {
          params: { api_key: this.tmdbApiKey },
          timeout: 8000
        })
      ]);

      const movie = movieRes.data;
      const credits = creditsRes.data;
      const director = credits.crew?.find(c => c.job === 'Director');

      return {
        title: movie.title,
        rating: parseFloat((movie.vote_average || 0).toFixed(1)),
        vote_count: movie.vote_count,
        link: `https://movie.douban.com/subject_search?search_text=${encodeURIComponent(movie.title)}`,
        image: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '',
        description: movie.overview || '暂无简介',
        release_date: movie.release_date,
        runtime: movie.runtime,
        director: director?.name || '未知',
        genres: movie.genres?.map(g => g.name) || [],
        id: movie.id,
        original_title: movie.original_title,
        genre_ids: movie.genres?.map(g => g.id) || [],
        budget: movie.budget,
        revenue: movie.revenue,
        tagline: movie.tagline
      };
    } catch (error) {
      console.error('获取电影详情失败:', error.message);
      return null;
    }
  }

  getMockMovies(count = 3, returnAll = false) {
    const IMG = 'https://image.tmdb.org/t/p/w500';
    const allMovies = [
      { title: '肖申克的救赎', rating: 9.7, vote_count: 234567, link: 'https://movie.douban.com/subject/1292052/', image: `${IMG}/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg`, description: '希望让人自由。被冤枉的银行家在监狱中凭借智慧改变命运。', release_date: '1994-09-23', id: 278, original_title: 'The Shawshank Redemption', genre_ids: [18, 80] },
      { title: '阿甘正传', rating: 9.5, vote_count: 198765, link: 'https://movie.douban.com/subject/1292720/', image: `${IMG}/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg`, description: '一部美国近现代史。智商75的阿甘用最单纯的心跑过了整个时代。', release_date: '1994-07-06', id: 13, original_title: 'Forrest Gump', genre_ids: [18, 35] },
      { title: '泰坦尼克号', rating: 9.4, vote_count: 187654, link: 'https://movie.douban.com/subject/1292722/', image: `${IMG}/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg`, description: 'You jump, I jump。穷小子和富家女在巨轮上的一段跨越阶级的爱情。', release_date: '1997-12-19', id: 597, original_title: 'Titanic', genre_ids: [18, 10749] },
      { title: '盗梦空间', rating: 9.3, vote_count: 218186, link: 'https://movie.douban.com/subject/3541415/', image: `${IMG}/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg`, description: '多重梦境烧脑神作。盗梦者可潜入梦境植入想法，层层嵌套分不清现实。', release_date: '2010-09-01', id: 27205, original_title: 'Inception', genre_ids: [28, 12, 14, 878] },
      { title: '星际穿越', rating: 9.4, vote_count: 189999, link: 'https://movie.douban.com/subject/1889243/', image: `${IMG}/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg`, description: '探索宇宙与时间的史诗。宇航员穿越虫洞寻找人类新家园。', release_date: '2014-11-12', id: 157336, original_title: 'Interstellar', genre_ids: [12, 18, 878] },
      { title: '霸王别姬', rating: 9.6, vote_count: 223456, link: 'https://movie.douban.com/subject/1291546/', image: `${IMG}/c9XxwwhPHdaImA2f1WEfEsbhaFB.jpg`, description: '人生如戏戏如人生。两个京剧伶人半世纪的悲欢离合。', release_date: '1993-07-26', id: 10907, original_title: 'Farewell My Concubine', genre_ids: [18, 10751] },
      { title: '千与千寻', rating: 9.4, vote_count: 215678, link: 'https://movie.douban.com/subject/1291561/', image: `${IMG}/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg`, description: '奇幻冒险之旅。10岁女孩千寻误入神明世界开始勇敢成长。', release_date: '2001-07-20', id: 129, original_title: 'Spirited Away', genre_ids: [16, 12, 14] },
      { title: '疯狂动物城', rating: 9.2, vote_count: 167890, link: 'https://movie.douban.com/subject/25662329/', image: `${IMG}/hlK0e0wAQ3VLuJcsfIYPvb4JVud.jpg`, description: '打破偏见追逐梦想。兔子警察和狐狸搭档揭开惊天阴谋。', release_date: '2016-03-04', id: 269149, original_title: 'Zootopia', genre_ids: [16, 35, 10751] },
      { title: '寻梦环游记', rating: 9.1, vote_count: 156789, link: 'https://movie.douban.com/subject/26683290/', image: `${IMG}/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg`, description: '关于家庭与记忆。小男孩误入亡灵之地寻找真相。', release_date: '2017-11-24', id: 354912, original_title: 'Coco', genre_ids: [16, 12, 10751] },
      { title: '楚门的世界', rating: 9.3, vote_count: 178901, link: 'https://movie.douban.com/subject/1292064/', image: `${IMG}/vuza0WqY239yBXOadKlGwJsZJFE.jpg`, description: '如果再也不能见到你，祝你早安午安晚安。楚门的一举一动都被全球直播。', release_date: '1998-06-01', id: 37165, original_title: 'The Truman Show', genre_ids: [18, 10749] },
      { title: '黑客帝国', rating: 9.1, vote_count: 187654, link: 'https://movie.douban.com/subject/1291841/', image: `${IMG}/aOIuZAjPaRIE6CMzbazvcHuHXDc.jpg`, description: '现实与虚拟的边界。尼奥发现世界其实是由矩阵控制的虚拟现实。', release_date: '1999-03-31', id: 603, original_title: 'The Matrix', genre_ids: [28, 878] },
      { title: '蝙蝠侠：黑暗骑士', rating: 9.2, vote_count: 165432, link: 'https://movie.douban.com/subject/1845171/', image: `${IMG}/qJ2tW6WMUDux911r6m7haRef0WH.jpg`, description: '超级英雄电影巅峰。蝙蝠侠面临史上最强反派小丑的终极挑战。', release_date: '2008-07-18', id: 155, original_title: 'The Dark Knight', genre_ids: [28, 80, 18] },
      { title: '海上钢琴师', rating: 9.3, vote_count: 198765, link: 'https://movie.douban.com/subject/1292001/', image: `${IMG}/qNbMsKVzigERgJUbwf8pKyZogpb.jpg`, description: '一生都在船上的钢琴天才，用音乐诠释对世界的理解。', release_date: '1998-10-28', id: 25237, original_title: 'The Legend of 1900', genre_ids: [18, 10402] },
      { title: '辛德勒的名单', rating: 9.5, vote_count: 176543, link: 'https://movie.douban.com/subject/1292213/', image: `${IMG}/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg`, description: '拯救一个人就是拯救全世界。商人用生命换来1200名犹太人的生还。', release_date: '1993-11-30', id: 424, original_title: "Schindler's List", genre_ids: [18, 36, 10752] },
      { title: '盗火线', rating: 8.5, vote_count: 87654, link: 'https://movie.douban.com/subject/1292017/', image: `${IMG}/e09dLw1Ljtccd2P4NsuUvVtS5du.jpg`, description: '警匪对决经典。洛杉矶最顶尖刑警与最顶尖劫匪的终极对决。', release_date: '1995-12-15', id: 949, original_title: 'Heat', genre_ids: [28, 80, 53] },
      { title: '七宗罪', rating: 8.8, vote_count: 145678, link: 'https://movie.douban.com/subject/1291836/', image: '', description: '以宗教为名的连环谋杀。七种罪行，一个扭曲灵魂的真实一课。', release_date: '1995-09-22', id: 807, original_title: 'Se7en', genre_ids: [80, 53, 18] },
      { title: '搏击俱乐部', rating: 9.0, vote_count: 167890, link: 'https://movie.douban.com/subject/1292000/', image: `${IMG}/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg`, description: '打破平庸生活的疯狂计划。第一条规则：不谈搏击俱乐部。', release_date: '1999-09-10', id: 550, original_title: 'Fight Club', genre_ids: [18, 53] },
      { title: '低俗小说', rating: 8.9, vote_count: 156789, link: 'https://movie.douban.com/subject/1291847/', image: `${IMG}/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg`, description: '非线性叙事经典。几个无关故事通过巧合交织在一起。', release_date: '1994-10-14', id: 680, original_title: 'Pulp Fiction', genre_ids: [80, 35, 53] },
      { title: '这个杀手不太冷', rating: 9.4, vote_count: 212345, link: 'https://movie.douban.com/subject/1295644/', image: `${IMG}/bxB2q91nKYp8JNzqE7t7TWBVupB.jpg`, description: '杀手与小女孩的温情故事。孤独的莱昂与邻家女孩的守护之情。', release_date: '1994-09-14', id: 101, original_title: 'Léon: The Professional', genre_ids: [28, 18, 53] },
      { title: '美丽人生', rating: 9.5, vote_count: 189012, link: 'https://movie.douban.com/subject/1292063/', image: `${IMG}/6tEJnof1DKWPnl5lzkjf0FVv7oB.jpg`, description: '用谎言编织美好童年。父亲在纳粹集中营为儿子编织美丽游戏。', release_date: '1997-12-20', id: 637, original_title: 'Life Is Beautiful', genre_ids: [35, 18, 10751] }
    ];

    const processed = allMovies.map(movie => {
      if (!movie.image || movie.image.trim() === '') {
        return { ...movie, image: this.posterManager.generateDefaultPoster(movie) };
      }
      return movie;
    });

    if (returnAll) {
      return this.validateAllMovies(processed);
    }

    const shuffled = [...processed].sort(() => Math.random() - 0.5);
    return this.validateAllMovies(shuffled.slice(0, count));
  }

  async checkPosterIntegrity(movies) {
    return await this.posterManager.checkPosterIntegrity(movies);
  }

  async fixMissingPosters(movies) {
    return await this.posterManager.fixMissingPosters(movies);
  }

  async updateAllPosters(movies) {
    return await this.posterManager.updateAllPosters(movies);
  }

  async verifyAllPosters(movies) {
    return await this.posterManager.verifyAllPosters(movies);
  }

  async ensureAllPosters(movies) {
    console.log('\n=== 确保所有电影海报完整 ===');
    
    const verifyResult = await this.verifyAllPosters(movies);
    
    if (verifyResult.failed > 0) {
      console.log(`发现 ${verifyResult.failed} 部电影海报无效，开始修复...`);
      await this.fixMissingPosters(movies);
    } else {
      console.log('所有海报验证通过，无需修复');
    }
    
    const finalResult = await this.verifyAllPosters(movies);
    return finalResult;
  }
}

module.exports = MovieFetcher;
