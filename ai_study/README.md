# 🧠 AI智能学习助手

基于 Python + Gradio 构建的一站式学习辅助平台，集成拍照搜题、多语言翻译和智能对话答疑功能。

## ✨ 功能特性

### 📷 OCR拍照搜题
- 支持上传题目图片进行文字识别
- 自动修正数学符号（如 x²、log₂、∫ 等）
- AI智能分析并解答各类学科题目
- 支持中英文混合识别

### 🌐 语言互译
- 支持8种语言互译：中文、英语、日语、韩语、法语、德语、西班牙语、俄语
- 保持学科术语准确性
- 实时翻译结果展示

### 💬 学科对话答疑
- 与AI助手"小帮"进行学科对话
- 快捷问题一键提问
- 对话统计（次数、话题识别）
- 上下文相关回答

## 🚀 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装依赖
```bash
pip install -r requirements.txt
```

### 配置环境变量

复制 `.env.example` 文件并重命名为 `.env`：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 API 密钥：
```
OPENAI_API_KEY=your_api_key_here
```

### 启动应用
```bash
python ai_study_app.py
```

访问 http://localhost:7860 即可使用。

## ⚙️ 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 密钥（必填） | - |
| `OPENAI_BASE_URL` | API 基础地址 | https://api.siliconflow.cn/v1 |
| `OPENAI_MODEL` | 使用的模型名称 | deepseek-ai/DeepSeek-R1-0528-Qwen3-8B |
| `LLM_TIMEOUT` | LLM 调用超时时间（秒） | 120 |
| `LLM_MAX_RETRIES` | 重试次数 | 3 |
| `OCR_LANG` | OCR 识别语言 | ch |

## 📁 项目结构
```
ai_study/
├── ai_study_app.py    # 主应用文件
├── avatar.png         # AI助手头像
├── requirements.txt   # 依赖列表
├── .env.example       # 配置模板
└── README.md          # 项目文档
```

## 🛠️ 技术栈
- **前端框架**: Gradio
- **图像识别**: PaddleOCR
- **AI模型**: OpenAI API
- **图像处理**: Pillow

## 📝 使用说明

1. **拍照搜题**: 上传题目图片，点击"一键搜题"
2. **语言互译**: 输入文本，选择源语言和目标语言，点击"翻译"
3. **对话答疑**: 输入问题或点击快捷问题按钮，与AI助手对话

## 📄 许可证

MIT License