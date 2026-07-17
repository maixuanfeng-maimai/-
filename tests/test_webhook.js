const axios = require('axios');

async function testWebhook() {
  try {
    console.log('🔍 测试钉钉Webhook...');
    
    const response = await axios.post('http://localhost:3000/api/webhook/dingtalk', {
      msgtype: 'text',
      text: {
        content: '@电影推荐 推荐一部科幻片'
      }
    });
    
    console.log('✅ 响应成功:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testWebhook();