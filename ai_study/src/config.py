import os
from dotenv import load_dotenv

load_dotenv()

CONFIG = {
    "openai_api_key": os.getenv("OPENAI_API_KEY"),
    "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.siliconflow.cn/v1"),
    "openai_model": os.getenv("OPENAI_MODEL", "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B"),
    "openai_model_chat": os.getenv("OPENAI_MODEL_CHAT", "Qwen/Qwen2.5-7B-Instruct"),
    "llm_timeout": int(os.getenv("LLM_TIMEOUT", "60")),
    "llm_max_retries": int(os.getenv("LLM_MAX_RETRIES", "3")),
    "ocr_lang": os.getenv("OCR_LANG", "ch"),
    "ocr_use_angle_cls": True,
    "ocr_use_textline_orientation": True,
    "log_level": os.getenv("LOG_LEVEL", "INFO"),
    "gradio_port": int(os.getenv("GRADIO_PORT", "7860")),
}


def validate_config():
    errors = []
    warnings = []
    
    api_key = CONFIG["openai_api_key"]
    if not api_key:
        errors.append("❌ OPENAI_API_KEY 未配置")
    elif api_key in ("your_api_key_here", "sk-", "your-key-here", "api_key"):
        errors.append("❌ OPENAI_API_KEY 使用的是占位符，请替换为真实密钥")
    elif len(api_key) < 10:
        errors.append("❌ OPENAI_API_KEY 长度不足，请检查配置")
    else:
        warnings.append("✅ OPENAI_API_KEY 已配置")
    
    if not CONFIG["openai_base_url"]:
        warnings.append("⚠️ OPENAI_BASE_URL 使用默认值")
    else:
        warnings.append("✅ OPENAI_BASE_URL 已配置")
    
    if CONFIG["llm_timeout"] < 30:
        warnings.append("⚠️ LLM_TIMEOUT 建议不低于30秒")
    
    if CONFIG["llm_max_retries"] < 1:
        warnings.append("⚠️ LLM_MAX_RETRIES 建议至少1次")
    
    return errors, warnings

OUTPUT_FORMAT_CONSTRAINT_OCR = """

=== OCR容错处理 ===
注意：以下题目内容可能包含OCR识别错误（如字符误识别、数学符号变形、乱码字符），请根据上下文推断正确的数学表达式后再进行解答。

常见OCR识别错误模式：
- "V"或"v"可能是"√"（根号）
- "除"可能是"÷"（除号）
- "乘"可能是"×"（乘号）
- "加"可能是"+"（加号）
- "减"可能是"-"（减号）
- "等于"可能是"="（等号）
- "平方"可能是"²"
- "立方"可能是"³"
- 数字和字母可能被错误识别，请根据数学逻辑推断

请遵循以下步骤：
1. 首先通读题目，理解整体含义
2. 识别可能的OCR错误并进行修正
3. 根据修正后的题目进行解答
4. 如果题目过于模糊无法推断，请直接说明

=== 输出格式要求 ===
1. 直接解答，不要提问或猜测
2. 使用标准数学符号：+ - = × ÷ √ π，用"x²"表示平方
3. 禁止使用HTML标签和LaTeX格式
4. 禁止输出重复字符或无意义乱码
5. 保持中文输出，结构清晰，使用换行分隔"""

OUTPUT_FORMAT_CONSTRAINT_SIMPLE = """

=== 输出格式要求 ===
1. 直接解答，不要提问或猜测
2. 使用标准数学符号：+ - = × ÷ √ π，用"x²"表示平方
3. 禁止使用HTML标签和LaTeX格式
4. 禁止输出重复字符或无意义乱码
5. 保持中文输出，结构清晰，使用换行分隔"""

MATH_SYMBOL_CORRECTIONS = [
    ("x2", "x²"),
    ("x3", "x³"),
    ("^2", "²"),
    ("^3", "³"),
    ("log2", "log₂"),
    ("log3", "log₃"),
    ("log10", "log₁₀"),
    ("sin(", "sin("),
    ("cos(", "cos("),
    ("tan(", "tan("),
    ("log(", "log("),
    ("lim(", "lim("),
]