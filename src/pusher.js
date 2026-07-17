const axios = require('axios');
const crypto = require('crypto');

class Pusher {
  constructor(config) {
    this.wecomWebhookUrl = config.wecomWebhookUrl;
    this.dingtalkWebhookUrl = config.dingtalkWebhookUrl;
    this.dingtalkSecret = config.dingtalkSecret;
    this.pushTarget = config.pushTarget || 'all';
  }

  async pushToWecomText(text) {
    if (!this.wecomWebhookUrl) {
      console.log('企业微信Webhook URL未配置');
      return false;
    }
    
    const cleanText = text.replace(/!\[.*?\]\(.*?\)/g, '').trim();
    
    const content = {
      msgtype: 'text',
      text: {
        content: cleanText
      }
    };
    
    try {
      await axios.post(this.wecomWebhookUrl, content);
      console.log('企业微信文本推送成功');
      return true;
    } catch (error) {
      console.error('企业微信文本推送失败:', error.message);
      return false;
    }
  }

  async pushToDingtalk(content) {
    if (!this.dingtalkWebhookUrl) {
      console.log('钉钉Webhook URL未配置');
      return false;
    }
    
    try {
      if (this.dingtalkSecret) {
        const timestamp = Date.now();
        const sign = this.generateDingtalkSign(timestamp);
        const url = `${this.dingtalkWebhookUrl}&timestamp=${timestamp}&sign=${sign}`;
        await axios.post(url, content);
      } else {
        await axios.post(this.dingtalkWebhookUrl, content);
      }
      console.log('钉钉推送成功');
      return true;
    } catch (error) {
      console.error('钉钉推送失败:', error.message);
      return false;
    }
  }

  async pushToDingtalkText(text) {
    if (!this.dingtalkWebhookUrl) {
      console.log('钉钉Webhook URL未配置');
      return false;
    }
    
    const content = {
      msgtype: 'text',
      text: {
        content: text
      }
    };
    
    try {
      if (this.dingtalkSecret) {
        const timestamp = Date.now();
        const sign = this.generateDingtalkSign(timestamp);
        const url = `${this.dingtalkWebhookUrl}&timestamp=${timestamp}&sign=${sign}`;
        await axios.post(url, content);
      } else {
        await axios.post(this.dingtalkWebhookUrl, content);
      }
      console.log('钉钉文本推送成功');
      return true;
    } catch (error) {
      console.error('钉钉文本推送失败:', error.message);
      return false;
    }
  }

  generateDingtalkSign(timestamp) {
    const stringToSign = `${timestamp}\n${this.dingtalkSecret}`;
    const hmac = crypto.createHmac('sha256', this.dingtalkSecret);
    const sign = hmac.update(stringToSign).digest('base64');
    return encodeURIComponent(sign);
  }

  async push(text) {
    const results = [];
    
    if (this.pushTarget === 'wecom' || this.pushTarget === 'all') {
      results.push(await this.pushToWecomText(text));
    }
    
    if (this.pushTarget === 'dingtalk' || this.pushTarget === 'all') {
      results.push(await this.pushToDingtalkText(text));
    }
    
    return results.every(Boolean);
  }
}

module.exports = Pusher;