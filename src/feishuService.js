const axios = require('axios');

class FeishuService {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.accessToken = null;
    this.tokenExpireTime = 0;
    this.baseUrl = 'https://open.feishu.cn/open-apis';
  }

  async getAccessToken() {
    if (!this.appId || !this.appSecret) {
      console.log('飞书App ID或App Secret未配置');
      return null;
    }

    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/v3/tenant_access_token/internal`,
        {
          app_id: this.appId,
          app_secret: this.appSecret
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        this.tokenExpireTime = Date.now() + (response.data.expire - 60) * 1000;
        console.log('✅ 飞书AccessToken获取成功');
        return this.accessToken;
      } else {
        console.error('❌ 获取飞书AccessToken失败:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ 获取飞书AccessToken异常:', error.message);
      return null;
    }
  }

  async createSpreadsheet(name) {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await axios.post(
        `${this.baseUrl}/sheet/v3/spreadsheets`,
        {
          title: name
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.code === 0) {
        console.log(`✅ 创建飞书表格成功: ${name}`);
        return response.data.data.spreadsheet_token;
      } else {
        console.error('❌ 创建飞书表格失败:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ 创建飞书表格异常:', error.message);
      return null;
    }
  }

  async getSpreadsheetInfo(spreadsheetToken) {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await axios.get(
        `${this.baseUrl}/sheet/v3/spreadsheets/${spreadsheetToken}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.code === 0) {
        return response.data.data;
      } else {
        console.error('❌ 获取飞书表格信息失败:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ 获取飞书表格信息异常:', error.message);
      return null;
    }
  }

  async addSheet(spreadsheetToken, sheetName) {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await axios.post(
        `${this.baseUrl}/sheet/v3/spreadsheets/${spreadsheetToken}/sheets`,
        {
          title: sheetName
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.code === 0) {
        console.log(`✅ 创建Sheet成功: ${sheetName}`);
        return response.data.data.sheet_id;
      } else {
        console.error('❌ 创建Sheet失败:', response.data);
        return null;
      }
    } catch (error) {
      console.error('❌ 创建Sheet异常:', error.message);
      return null;
    }
  }

  async setHeader(spreadsheetToken, sheetId) {
    const token = await this.getAccessToken();
    if (!token) return false;

    // 严格对应的字段映射：日期、电影标题、评分、海报链接、推荐文案
    const headers = ['日期', '电影标题', '评分', '海报链接', '推荐文案'];

    try {
      const response = await axios.patch(
        `${this.baseUrl}/sheet/v3/spreadsheets/${spreadsheetToken}/values`,
        {
          value_range: {
            sheet_id: sheetId,
            range: 'A1:E1',
            values: [headers]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.code === 0) {
        console.log('✅ 设置表头成功 - 字段：日期、电影标题、评分、海报链接、推荐文案');
        return true;
      } else {
        console.error('❌ 设置表头失败:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ 设置表头异常:', error.message);
      return false;
    }
  }

  async appendRow(spreadsheetToken, sheetId, data) {
    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      const response = await axios.post(
        `${this.baseUrl}/sheet/v3/spreadsheets/${spreadsheetToken}/values_append`,
        {
          value_range: {
            sheet_id: sheetId,
            values: [data]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.code === 0) {
        console.log('✅ 追加记录成功');
        return true;
      } else {
        console.error('❌ 追加记录失败:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ 追加记录异常:', error.message);
      return false;
    }
  }

  async getSpreadsheetTokenByName(name) {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await axios.get(
        `${this.baseUrl}/drive/v1/files`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            query: `title = "${name}" and type = "sheet"`
          }
        }
      );

      if (response.data && response.data.code === 0 && response.data.data.items.length > 0) {
        return response.data.data.items[0].token;
      } else {
        return null;
      }
    } catch (error) {
      console.error('❌ 查询表格失败:', error.message);
      return null;
    }
  }

  async ensureSpreadsheet(name) {
    let spreadsheetToken = await this.getSpreadsheetTokenByName(name);

    if (!spreadsheetToken) {
      spreadsheetToken = await this.createSpreadsheet(name);
    }

    if (spreadsheetToken) {
      const info = await this.getSpreadsheetInfo(spreadsheetToken);
      let sheetId = null;

      if (info && info.sheets && info.sheets.length > 0) {
        sheetId = info.sheets[0].sheet_id;
      } else {
        sheetId = await this.addSheet(spreadsheetToken, '记录');
      }

      if (sheetId) {
        const headerSet = await this.setHeader(spreadsheetToken, sheetId);
        if (headerSet) {
          return { spreadsheetToken, sheetId };
        }
      }
    }

    return null;
  }

  async saveMovieRecord(movie, content) {
    const tableInfo = await this.ensureSpreadsheet('每日电影推荐记录');
    if (!tableInfo) {
      console.log('⚠️ 飞书表格未配置或创建失败，跳过保存');
      return false;
    }

    const today = new Date().toLocaleDateString('zh-CN');
    
    // 严格对应的数据映射：日期、电影标题、评分、海报链接、推荐文案
    const rowData = [
      today,
      movie.title || '',
      movie.rating || '',
      movie.image || '',  // 海报链接 - 确保是完整的HTTPS地址
      content || ''
    ];

    console.log('📝 准备保存电影记录:');
    console.log('  标题:', movie.title);
    console.log('  海报:', movie.image);
    console.log('  评分:', movie.rating);

    return await this.appendRow(tableInfo.spreadsheetToken, tableInfo.sheetId, rowData);
  }

  async clearAllData() {
    const tableInfo = await this.ensureSpreadsheet('每日电影推荐记录');
    if (!tableInfo) {
      console.log('⚠️ 飞书表格未配置或创建失败，跳过清空');
      return false;
    }

    const token = await this.getAccessToken();
    if (!token) return false;

    try {
      // 先获取所有数据行数
      const response = await axios.get(
        `${this.baseUrl}/sheet/v3/spreadsheets/${tableInfo.spreadsheetToken}/values/${tableInfo.sheetId}!A:E`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.code === 0) {
        const values = response.data.data.value_range.values || [];
        const totalRows = values.length;
        
        if (totalRows <= 1) {
          console.log('📋 表格只有表头，无需清空');
          return true;
        }

        // 删除第2行到最后一行（保留表头）
        const deleteResponse = await axios.delete(
          `${this.baseUrl}/sheet/v3/spreadsheets/${tableInfo.spreadsheetToken}/values`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            data: {
              value_range: {
                sheet_id: tableInfo.sheetId,
                range: `A2:E${totalRows}`
              }
            }
          }
        );

        if (deleteResponse.data && deleteResponse.data.code === 0) {
          console.log(`✅ 已清空表格中的 ${totalRows - 1} 条旧数据`);
          return true;
        } else {
          console.error('❌ 清空表格失败:', deleteResponse.data);
          return false;
        }
      } else {
        console.error('❌ 获取表格数据失败:', response.data);
        return false;
      }
    } catch (error) {
      console.error('❌ 清空表格异常:', error.message);
      return false;
    }
  }

  async getRecommendedMovies() {
    const tableInfo = await this.ensureSpreadsheet('每日电影推荐记录');
    if (!tableInfo) {
      console.log('⚠️ 飞书表格未配置，返回空列表');
      return [];
    }

    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      const response = await axios.get(
        `${this.baseUrl}/sheet/v3/spreadsheets/${tableInfo.spreadsheetToken}/values/${tableInfo.sheetId}!A:B`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.code === 0) {
        const values = response.data.data.value_range.values || [];
        const movieTitles = [];
        
        for (let i = 1; i < values.length; i++) {
          if (values[i] && values[i][1]) {
            movieTitles.push(values[i][1].toString().trim());
          }
        }
        
        console.log(`📊 已推荐的电影数量: ${movieTitles.length}`);
        return movieTitles;
      } else {
        console.error('❌ 获取推荐记录失败:', response.data);
        return [];
      }
    } catch (error) {
      console.error('❌ 获取推荐记录异常:', error.message);
      return [];
    }
  }

  async isMovieRecommended(movieTitle) {
    const recommendedMovies = await this.getRecommendedMovies();
    return recommendedMovies.includes(movieTitle.toString().trim());
  }

  async getAllHistory() {
    const tableInfo = await this.ensureSpreadsheet('每日电影推荐记录');
    if (!tableInfo) {
      return [];
    }

    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      // 读取A到E列，包含海报链接字段
      const response = await axios.get(
        `${this.baseUrl}/sheet/v3/spreadsheets/${tableInfo.spreadsheetToken}/values/${tableInfo.sheetId}!A:E`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.code === 0) {
        const values = response.data.data.value_range.values || [];
        const records = [];
        const historyMap = new Map();

        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (row && row[0] && row[1]) {
            const date = row[0];
            const movieTitle = row[1];
            const rating = row[2] || 0;
            const posterUrl = row[3] || '';  // 海报链接
            const content = row[4] || '';   // 推荐文案

            if (!historyMap.has(date)) {
              historyMap.set(date, {
                id: `history-${i}`,
                date: date,
                movies: [],
                status: 'success',
                target: process.env.PUSH_TARGET || 'all'
              });
            }

            historyMap.get(date).movies.push({
              title: movieTitle,
              rating: parseFloat(rating) || 0,
              image: posterUrl  // 包含海报链接
            });
          }
        }

        historyMap.forEach((record) => {
          records.push(record);
        });

        console.log(`📊 从飞书表格获取到 ${records.length} 条历史记录`);
        return records.reverse();
      } else {
        return [];
      }
    } catch (error) {
      console.error('❌ 获取完整历史异常:', error.message);
      return [];
    }
  }
}

module.exports = FeishuService;