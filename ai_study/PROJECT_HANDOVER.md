# AI智能学习助手 - 项目交接文档

## 1. 固定技术栈

| 类别 | 技术 | 版本要求 |
|------|------|----------|
| 前端框架 | Gradio | >=4.0.0 |
| 后端语言 | Python | 3.11+ |
| OCR引擎 | PaddleOCR | >=2.0.0 |
| LLM SDK | OpenAI | >=1.0.0 |
| 图像处理 | Pillow | >=10.0.0 |
| 配置管理 | python-dotenv | >=1.0.0 |
| API网关 | SiliconFlow | 第三方服务 |

## 2. 全局规则

### 2.1 功能约束
> 注：以下约束来自项目历史要求，当前代码库中不存在quiz_module.py等相关文件，仅供参考
- 简答题批改逻辑**不得**调用LLM

### 2.2 性能要求
- OCR识别响应时间：标准题目图片≤5秒
- LLM调用超时：30-60秒（当前配置120秒）
- LLM调用需配置重试机制（当前3次）

### 2.3 安全规范
- API密钥必须通过环境变量配置，**禁止**硬编码
- 配置文件需验证：空值检查、占位符检查、长度检查
- 敏感信息**禁止**打印到日志或输出到前端

## 3. 项目结构

```
ai_study/
├── ai_study_app.py          # 主应用入口（Gradio UI）
├── avatar.png               # 数字人头像图片
├── .env                     # 环境变量配置（敏感）
├── .env.example             # 环境变量示例模板
├── requirements.txt         # 项目依赖清单
├── logs/
│   └── app_YYYYMMDD.log     # 应用日志文件（按日期轮转）
└── src/
    ├── __init__.py          # 模块初始化
    ├── config.py            # 配置管理与验证
    ├── logging_config.py    # 日志系统配置
    ├── ocr_utils.py         # OCR工具函数（图像预处理、文字识别、文本清洗）
    ├── llm_service.py       # LLM调用服务（API交互、流式响应、错误重试）
    └── chat_service.py      # 聊天与翻译功能（对话管理、翻译处理）
```

## 4. 核心文件路径与关键代码入口

### 4.1 主应用入口
- **文件**: [ai_study_app.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/ai_study_app.py)
- **启动入口**: `if __name__ == "__main__": main()`
- **核心函数**:
  - `main()` - 初始化Gradio界面，绑定所有事件
  - `handle_ocr(image)` - OCR识别处理
  - `handle_search(image)` - 一键搜题流程
  - `analyze_question(text)` - 题目分析与LLM解答
  - `chat_with_ai(message, history)` - 学科对话答疑
  - `translate_text(text, source_language, target_language)` - 语言互译

### 4.2 配置管理
- **文件**: [src/config.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/src/config.py)
- **关键函数**:
  - `CONFIG` - 全局配置字典
  - `validate_config()` - 配置验证（API密钥、超时设置检查）
- **关键常量**:
  - `MATH_SYMBOL_CORRECTIONS` - 数学符号修正映射表
  - `OUTPUT_FORMAT_CONSTRAINT_OCR` - OCR场景输出格式约束（含OCR容错指令）
  - `OUTPUT_FORMAT_CONSTRAINT_SIMPLE` - 聊天/翻译场景输出格式约束

### 4.3 OCR工具
- **文件**: [src/ocr_utils.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/src/ocr_utils.py)
- **关键函数**:
  - `init_ocr(force=False)` - OCR引擎初始化（支持预初始化）
  - `ocr_image(image)` - 图像文字识别主流程
  - `preprocess_image(image)` - 图像预处理（对比度、锐度、亮度增强）
  - `advanced_preprocess(image)` - 高级图像预处理（灰度化、高斯模糊降噪）
  - `clean_text(text)` - 文本清洗（移除转义字符、不可见字符）
  - `correct_math_symbols(text)` - 数学符号修正（带边界保护的正则替换）
  - `is_garbage_text(text)` - 乱码检测（判断识别结果是否为无意义乱码）
  - `detect_subject(text)` - 学科检测（基于关键词和数学结构特征）
  - `detect_question_type(text)` - 题型检测

### 4.4 LLM服务
- **文件**: [src/llm_service.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/src/llm_service.py)
- **关键函数**:
  - `get_openai_client()` - 获取OpenAI客户端（含API密钥验证）
  - `call_llm(messages, max_tokens, temperature)` - LLM调用主流程（支持流式响应）

### 4.5 聊天服务
- **文件**: [src/chat_service.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/src/chat_service.py)
- **关键函数**:
  - `chat_with_ai(message, history)` - 聊天对话处理
  - `translate_text(text, source_language, target_language)` - 翻译处理
  - `get_chat_stats(history)` - 对话统计

### 4.6 日志配置
- **文件**: [src/logging_config.py](file:///C:/Users/J3799/Documents/trae_projects/ai_study/src/logging_config.py)
- **配置**: 同时输出到文件和控制台，UTF-8编码

## 5. 已完成模块

### 5.1 OCR拍照搜题
- 图像上传与预处理
- PaddleOCR文字识别
- 文本清洗与符号修正
- 学科与题型自动检测
- 缓存机制（基于图片哈希）

### 5.2 语言互译
- 支持8种语言：中文、英语、日语、韩语、法语、德语、西班牙语、俄语
- 源语言与目标语言自由选择
- 学科术语准确翻译

### 5.3 学科对话答疑
- 多学科支持：数学、物理、化学、语文、英语、生物、历史、地理、计算机
- 快捷问题按钮（3个预设问题）
- 对话历史管理
- 对话统计（次数、当前话题）

## 6. 当前待开发功能清单

| 优先级 | 功能 | 状态 | 说明 |
|--------|------|------|------|
| P0 | 乱码问题修复 | 已完成 | 修复think标签过滤off-by-one bug和correct_math_symbols激进正则问题 |
| P0 | 学科误识别修复 | 已完成 | 优化数学符号修正和学科检测逻辑，解决数学题识别成历史题的问题 |
| P0 | 真源一致性修复 | 已完成 | 将OUTPUT_FORMAT_CONSTRAINT抽取到config.py统一管理，消除重复定义 |
| P1 | clean_text函数优化 | 待开发 | clean_text函数中仍保留多条激进正则，可能导致文本损坏，需进一步精简 |
| P1 | 识别准确性优化 | 待开发 | 进一步优化OCR识别准确率 |
| P1 | 响应速度优化 | 待开发 | 优化LLM调用速度，调整模型参数 |

## 7. 之前失败/废弃方案（踩坑记录）

### 7.1 致命错误
| 问题 | 原因 | 解决方案 |
|------|------|----------|
| OCR初始化失败 | 导入paddleocr用了别名但使用原模块名 | 统一使用`import paddleocr as ocr_module` |
| cvtColor错误 | OCR预处理返回boolean类型图像 | 确保预处理后返回RGB格式 |
| tuple index out of range | OCR预处理返回单通道灰度图像 | 强制转换为3通道RGB |

### 7.2 LLM调用问题
| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 401 Invalid token | API密钥未配置或使用占位符 | 在config.py添加验证逻辑 |
| 响应缓慢（55-62秒） | 使用推理模型DeepSeek-V3 | 切换到非推理模型Qwen2.5-7B-Instruct |
| 返回推理过程标签 | 模型返回`</think>`标签 | 在llm_service.py实现状态机过滤 |
| think标签过滤off-by-one | `</think>`长度计算错误（用9代替8） | 修正为`close_idx + 8` |
| 乱码输出 | correct_math_symbols正则过于激进 | 移除激进正则，只保留必要替换 |

### 7.3 文本处理问题
| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 十六进制转义字符 | PaddleOCR返回`\xXX`格式字符 | 在clean_text中添加过滤规则 |
| 重复字符输出 | LLM返回异常重复内容 | 添加首字符重复率检测日志 |
| 俄文字符乱码 | 使用推理模型导致输出异常 | 切换到非推理模型 |
| correct_math_symbols激进正则 | 过多正则替换破坏正常文本 | 精简函数，只保留必要替换 |

> **已知风险**：clean_text函数中仍保留多条激进正则（如合并相邻数字`(\d)\s+(\d)`、移除Unicode范围外字符），可能导致文本损坏，建议后续进一步精简

### 7.4 部署问题
| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 端口占用 | 7860端口被其他进程占用 | 使用`netstat -ano`查找并终止进程 |
| PowerShell语法错误 | 使用`&&`连接命令 | 使用分号`;`或设置cwd参数 |

## 8. 编码规范

### 8.1 文件命名
- 模块文件：小写蛇形命名（`ocr_utils.py`）
- 配置文件：`.env`（敏感）、`.env.example`（示例）
- 日志文件：按日期命名（`app_YYYYMMDD.log`）

### 8.2 代码规范
- 关键函数必须包含docstring
- 重要代码行需添加注释说明实现逻辑和关键参数
- 日志级别：DEBUG用于调试，INFO用于正常流程，WARNING用于警告，ERROR用于错误
- 异常处理：所有外部API调用必须包含重试机制和错误处理

### 8.3 安全规范
- API密钥必须通过环境变量配置，禁止硬编码
- 日志中禁止打印完整API密钥，仅记录前几位
- 配置验证：检查空值、占位符、长度
- **重要**：当前`.env`文件中的API密钥已在开发过程中暴露，接手后请立即轮换密钥

## 9. 启动方式

```bash
# 开发环境启动
cd "C:\Users\J3799\Documents\trae_projects\ai_study"
python ai_study_app.py

# 访问地址
http://localhost:7860
```

## 10. 环境变量配置

| 变量名 | 说明 | 默认值 | 当前.env值 | .env.example值 | 必填 |
|--------|------|--------|------------|---------------|------|
| OPENAI_API_KEY | OpenAI兼容API密钥 | - | 已配置 | your_api_key_here | 是 |
| OPENAI_BASE_URL | API基础地址 | https://api.siliconflow.cn/v1 | https://api.siliconflow.cn/v1 | https://api.siliconflow.cn/v1 | 否 |
| OPENAI_MODEL | 使用的模型名称 | deepseek-ai/DeepSeek-V3 | Qwen/Qwen2.5-7B-Instruct | deepseek-ai/DeepSeek-R1-0528-Qwen3-8B | 否 |
| LLM_TIMEOUT | LLM调用超时时间（秒） | 120 | 120 | 120 | 否 |
| LLM_MAX_RETRIES | 重试次数 | 3 | 3 | 3 | 否 |
| OCR_LANG | OCR语言 | ch | ch | ch | 否 |
| LOG_LEVEL | 日志级别 | INFO | INFO | - | 否 |

> **模型配置说明**：
> - `config.py`默认值：`Qwen/Qwen2.5-7B-Instruct`（推荐使用，响应快，输出稳定）
> - 当前`.env`实际值：`Qwen/Qwen2.5-7B-Instruct`
> - `.env.example`值：`deepseek-ai/DeepSeek-R1-0528-Qwen3-8B`（新模型，可测试）
> - **推荐**使用`Qwen/Qwen2.5-7B-Instruct`作为生产环境模型

## 11. 常见问题排查

### 11.1 端口占用
```bash
netstat -ano | findstr :7860
taskkill /F /PID <进程ID>
```

### 11.2 配置错误
检查`.env`文件是否正确配置API密钥，查看启动日志中的配置状态

### 11.3 OCR初始化失败
检查PaddleOCR安装是否完整，查看日志中的错误信息

### 11.4 LLM调用失败
检查网络连接、API密钥有效性、模型名称是否正确