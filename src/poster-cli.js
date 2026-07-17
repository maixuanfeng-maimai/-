#!/usr/bin/env node

const MovieFetcher = require('./movieFetcher');

async function main() {
  const movieFetcher = new MovieFetcher();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }
  
  const command = args[0];
  
  switch (command) {
    case 'check':
      await handleCheck(movieFetcher);
      break;
    case 'fix':
      await handleFix(movieFetcher);
      break;
    case 'verify':
      await handleVerify(movieFetcher);
      break;
    case 'update':
      await handleUpdate(movieFetcher);
      break;
    case 'ensure':
      await handleEnsure(movieFetcher);
      break;
    case 'report':
      await handleReport(movieFetcher);
      break;
    default:
      console.log(`未知命令: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
海报管理命令行工具

用法: node src/poster-cli.js <command>

命令列表:
  check     - 检查所有电影海报完整性
  fix       - 修复缺失或无效的海报
  verify    - 全量验证海报有效性
  update    - 更新所有海报（定期刷新）
  ensure    - 确保所有海报完整（检查+修复）
  report    - 生成海报状态报告

示例:
  node src/poster-cli.js check    # 检查海报完整性
  node src/poster-cli.js fix      # 修复缺失海报
  node src/poster-cli.js ensure   # 确保所有海报完整
  `);
}

async function handleCheck(movieFetcher) {
  console.log('\n=== 海报完整性检查 ===');
  const movies = await movieFetcher.getMockMovies(20);
  const result = await movieFetcher.checkPosterIntegrity(movies);
  
  console.log(`\n检查结果:`);
  console.log(`  总电影数: ${result.total}`);
  console.log(`  有效海报: ${result.valid} (${((result.valid / result.total) * 100).toFixed(1)}%)`);
  console.log(`  缺失海报: ${result.missing}`);
  console.log(`  无效海报: ${result.invalid}`);
  
  if (result.issues.length > 0) {
    console.log(`\n问题列表:`);
    result.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. [${issue.type.toUpperCase()}] ${issue.title} (ID: ${issue.movieId})`);
    });
  }
}

async function handleFix(movieFetcher) {
  console.log('\n=== 修复缺失海报 ===');
  const movies = await movieFetcher.getMockMovies(20);
  const result = await movieFetcher.fixMissingPosters(movies);
  
  console.log(`\n修复结果:`);
  console.log(`  处理总数: ${result.total}`);
  console.log(`  修复成功: ${result.fixed}`);
  console.log(`  使用默认: ${result.failed}`);
  console.log(`  跳过: ${result.skipped}`);
  
  if (result.details.length > 0) {
    console.log(`\n详情:`);
    result.details.forEach(detail => {
      const statusIcon = detail.status === 'fixed' ? '✓' : '⚠';
      console.log(`  ${statusIcon} ${detail.title}: ${detail.status === 'fixed' ? '已修复' : '使用默认海报'}`);
    });
  }
}

async function handleVerify(movieFetcher) {
  console.log('\n=== 全量海报验证 ===');
  const movies = await movieFetcher.getMockMovies(20);
  const result = await movieFetcher.verifyAllPosters(movies);
  
  console.log(`\n验证结果:`);
  console.log(`  总电影数: ${result.total}`);
  console.log(`  验证通过: ${result.verified} (${((result.verified / result.total) * 100).toFixed(1)}%)`);
  console.log(`  验证失败: ${result.failed}`);
  
  if (result.failedMovies.length > 0) {
    console.log(`\n失败列表:`);
    result.failedMovies.forEach((movie, index) => {
      console.log(`  ${index + 1}. ${movie.title} (ID: ${movie.id}): ${movie.reason}`);
    });
  }
}

async function handleUpdate(movieFetcher) {
  console.log('\n=== 更新所有海报 ===');
  const movies = await movieFetcher.getMockMovies(20);
  const result = await movieFetcher.updateAllPosters(movies);
  
  console.log(`\n更新结果:`);
  console.log(`  更新成功: ${result.updated}`);
  console.log(`  跳过(缓存有效): ${result.skipped}`);
  console.log(`  更新失败: ${result.errors}`);
}

async function handleEnsure(movieFetcher) {
  console.log('\n=== 确保所有海报完整 ===');
  const movies = await movieFetcher.getMockMovies(20);
  const result = await movieFetcher.ensureAllPosters(movies);
  
  console.log(`\n最终结果:`);
  console.log(`  总电影数: ${result.total}`);
  console.log(`  验证通过: ${result.verified} (${((result.verified / result.total) * 100).toFixed(1)}%)`);
  console.log(`  验证失败: ${result.failed}`);
  
  if (result.failed === 0) {
    console.log('\n✅ 所有电影海报验证通过！');
  } else {
    console.log('\n⚠ 仍有部分电影海报无效');
  }
}

async function handleReport(movieFetcher) {
  console.log('\n=== 海报状态报告 ===');
  const movies = await movieFetcher.getMockMovies(20);
  
  console.log('\n1. 基本信息');
  console.log(`   电影总数: ${movies.length}`);
  
  const integrity = await movieFetcher.checkPosterIntegrity(movies);
  
  console.log('\n2. 海报完整性');
  console.log(`   有效海报: ${integrity.valid}`);
  console.log(`   缺失海报: ${integrity.missing}`);
  console.log(`   无效海报: ${integrity.invalid}`);
  console.log(`   完整率: ${((integrity.valid / integrity.total) * 100).toFixed(1)}%`);
  
  console.log('\n3. 海报来源分布');
  const sourceStats = {
    tmdb: 0,
    other: 0,
    default: 0
  };
  
  movies.forEach(movie => {
    if (movie.image.includes('image.tmdb.org')) {
      sourceStats.tmdb++;
    } else if (movie.image.startsWith('data:image/svg')) {
      sourceStats.default++;
    } else {
      sourceStats.other++;
    }
  });
  
  console.log(`   TMDB: ${sourceStats.tmdb}`);
  console.log(`   默认SVG: ${sourceStats.default}`);
  console.log(`   其他来源: ${sourceStats.other}`);
  
  console.log('\n4. 评分分布');
  const ratingGroups = {
    '9.5+': 0,
    '9.0-9.4': 0,
    '8.5-8.9': 0,
    '8.0-8.4': 0,
    '<8.0': 0
  };
  
  movies.forEach(movie => {
    const rating = movie.rating || 0;
    if (rating >= 9.5) ratingGroups['9.5+']++;
    else if (rating >= 9.0) ratingGroups['9.0-9.4']++;
    else if (rating >= 8.5) ratingGroups['8.5-8.9']++;
    else if (rating >= 8.0) ratingGroups['8.0-8.4']++;
    else ratingGroups['<8.0']++;
  });
  
  Object.entries(ratingGroups).forEach(([range, count]) => {
    console.log(`   ${range}: ${count}`);
  });
}

main().catch(error => {
  console.error('命令执行失败:', error.message);
  process.exit(1);
});