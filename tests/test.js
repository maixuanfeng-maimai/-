require('dotenv').config();
const MovieRecommender = require('../src/index');

async function main() {
  console.log('🧪 开始测试每日电影推荐系统...\n');
  
  const recommender = new MovieRecommender();
  
  await recommender.testRun();
  
  console.log('\n✅ 测试完成！');
}

main().catch(console.error);
