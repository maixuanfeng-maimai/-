import os
import time
import hashlib
from typing import Generator, Tuple, List, Dict

import gradio as gr

from src.config import CONFIG, validate_config, OUTPUT_FORMAT_CONSTRAINT_OCR
from src.logging_config import logger
from src.ocr_utils import init_ocr, ocr_image, preprocess_image, is_ocr_initialized, detect_subject, detect_question_type
from src.chat_service import chat_with_ai, translate_text, get_chat_stats

logger.info("AI智能学习助手启动中...")

errors, warnings = validate_config()
if errors:
    for error in errors:
        logger.error(error)
if warnings:
    for warning in warnings:
        logger.info(warning)

logger.info("正在预初始化OCR引擎...")
start_time = time.time()
ocr_success, ocr_msg = init_ocr()
ocr_init_time = time.time() - start_time
logger.info(f"OCR预初始化完成: {ocr_msg}, 耗时 {ocr_init_time:.2f}s")

if ocr_success:
    warnings.append(f"✅ OCR引擎预初始化完成 (耗时 {ocr_init_time:.2f}s)")

avatar_path = os.path.join(os.path.dirname(__file__), 'avatar.png')

_search_cache = {}
_CACHE_MAX_SIZE = 50


def get_image_hash(image):
    import io
    img_bytes = io.BytesIO()
    image.save(img_bytes, format='PNG')
    return hashlib.md5(img_bytes.getvalue()).hexdigest()[:16]


def handle_ocr(image) -> str:
    if not is_ocr_initialized():
        init_ocr()
    
    extracted_text, status = ocr_image(image)
    if not extracted_text:
        return f"识别失败: {status}"
    
    return extracted_text


def analyze_question(text: str) -> Generator[str, None, None]:
    current_text = f"\n识别到的题目：\n{text}"
    yield current_text

    subject = detect_subject(text)
    question_type = detect_question_type(text)
    
    current_text += f"\n\n📊 题目分析：\n- 学科：{subject}\n- 题型：{question_type}"
    yield current_text

    current_text += "\n\n正在分析解答..."
    yield current_text

    system_prompts = {
        '数学': """你是一位专业的数学老师，擅长解答初中和高中数学题目。请用中文详细分析题目，给出清晰的解题思路和答案。

解题要求：
1. 如果是选择题：先给出答案，再详细解析每个选项的对错原因
2. 如果是填空题：给出答案，并简要说明解题步骤
3. 如果是解答题：给出完整的解题步骤，包括公式推导和计算过程
4. 如果是计算题：分步展示计算过程，注意单位和精度
5. 使用标准数学符号，如：√（根号）、×（乘号）、÷（除号）、π（圆周率）等
6. 对于几何题，描述辅助线的作法和几何关系
7. 答案要清晰、易于理解""" + OUTPUT_FORMAT_CONSTRAINT_OCR,
        
        '物理': """你是一位专业的物理老师，擅长解答初中和高中物理题目。请用中文详细分析题目，给出清晰的解题思路和答案。

解题要求：
1. 先明确题目涉及的物理概念和公式
2. 列出已知条件和待求量
3. 写出完整的解题过程，包括公式代入和单位换算
4. 对于力学题：分析受力情况，画出受力示意图（文字描述）
5. 对于电学题：分析电路结构，说明各元件的作用
6. 注意物理量的单位和符号规范
7. 答案要清晰、易于理解""" + OUTPUT_FORMAT_CONSTRAINT_OCR,
        
        '化学': """你是一位专业的化学老师，擅长解答初中和高中化学题目。请用中文详细分析题目，给出清晰的解题思路和答案。

解题要求：
1. 如果是选择题：先给出答案，再详细解析每个选项的对错原因
2. 如果是填空题：给出答案，并简要说明理由
3. 如果是计算题：写出化学方程式，列出计算过程
4. 注意化学方程式的配平、物质的量计算、溶液浓度计算
5. 使用正确的化学符号和化学式
6. 对于实验题：描述实验现象和结论
7. 答案要清晰、易于理解""" + OUTPUT_FORMAT_CONSTRAINT_OCR,
        
        '英语': """你是一位专业的英语老师，擅长解答初中和高中英语题目。请用中文详细分析题目，给出清晰的解题思路和答案。

解题要求：
1. 如果是选择题：先给出答案，再详细解析每个选项的语法和语义
2. 如果是完形填空：给出每个空的答案，并说明选择理由
3. 如果是阅读理解：回答问题并引用原文支持
4. 如果是翻译题：给出准确的中文翻译，并说明难点
5. 分析涉及的语法知识、词汇用法和固定搭配
6. 答案要清晰、易于理解""" + OUTPUT_FORMAT_CONSTRAINT_OCR,
        
        '语文': """你是一位专业的语文老师，擅长解答初中和高中语文题目。请用中文详细分析题目，给出清晰的解题思路和答案。

解题要求：
1. 如果是选择题：先给出答案，再详细解析每个选项
2. 如果是阅读理解：分析文章主旨、写作手法、修辞手法
3. 如果是文言文：翻译原文，解释重点实词虚词
4. 如果是诗词鉴赏：分析意境、情感、表现手法
5. 如果是作文题：给出写作思路和提纲
6. 答案要清晰、易于理解""" + OUTPUT_FORMAT_CONSTRAINT_OCR,
        
        '综合学科': """你是一个专业的学科辅导老师，擅长解答各种学科题目（包括数学、物理、化学、英语、语文等）。请用中文详细分析题目，给出清晰的解题思路和答案。

答题格式要求：
1. 如果是选择题，请按题目序号列出答案和解析
2. 如果是完形填空，请按序号列出每个空的答案和选择理由
3. 如果是数学题，请给出详细的解题步骤
4. 如果是英语题，请给出中文翻译和解析
5. 答案要清晰、易于理解，避免使用过于专业的术语
6. 所有内容使用中文输出""" + OUTPUT_FORMAT_CONSTRAINT_OCR
    }
    
    system_prompt = system_prompts.get(subject, system_prompts['综合学科'])
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请解答以下{subject}题目（{question_type}），用中文输出答案和详细解析：\n\n{text}"}
    ]

    from src.llm_service import call_llm
    for chunk in call_llm(messages, max_tokens=1536):
        current_text += chunk
        yield current_text

    return current_text


def handle_search(image) -> Generator[str, None, None]:
    import time
    
    image_hash = get_image_hash(image)
    
    if image_hash in _search_cache:
        cached_result = _search_cache[image_hash]
        current_text = "⚡ 命中缓存，正在快速返回结果..."
        yield current_text
        time.sleep(0.5)
        yield cached_result
        return

    if not is_ocr_initialized():
        current_text = "正在初始化OCR引擎..."
        yield current_text

        success, msg = init_ocr()
        if not success:
            current_text += f"\n{msg}"
            yield current_text
            return
    else:
        current_text = "OCR引擎就绪..."
        yield current_text

    current_text += "\n正在预处理图片..."
    yield current_text

    current_text += "\n正在识别图片中的题目..."
    yield current_text

    extracted_text, status = ocr_image(image)
    if not extracted_text:
        current_text += f"\n{status}"
        yield current_text
        return

    for result in analyze_question(extracted_text):
        current_text = result
        yield current_text

    if len(_search_cache) >= _CACHE_MAX_SIZE:
        oldest_key = next(iter(_search_cache))
        del _search_cache[oldest_key]
    _search_cache[image_hash] = current_text


def handle_quick_question_1(history: List[dict]) -> Generator[Tuple[List[dict], str, str], None, None]:
    for result in chat_with_ai("学习中怎样避免拖延症？", history):
        yield result


def handle_quick_question_2(history: List[dict]) -> Generator[Tuple[List[dict], str, str], None, None]:
    for result in chat_with_ai("如何高效记课堂笔记？", history):
        yield result


def handle_quick_question_3(history: List[dict]) -> Generator[Tuple[List[dict], str, str], None, None]:
    for result in chat_with_ai("怎样提高数学解题能力？", history):
        yield result


def main():
    with gr.Blocks(title="AI智能学习助手") as demo:
        gr.Markdown("# 🧠 AI智能学习助手")
        gr.Markdown("集成拍照搜题、多语言翻译和学科对话答疑功能")

        with gr.Tabs():
            with gr.TabItem("📷 OCR拍照搜题"):
                with gr.Row():
                    with gr.Column():
                        image_input = gr.Image(label="上传题目图片", type="pil")
                        with gr.Row():
                            ocr_btn = gr.Button("🔍 识别题目", variant="secondary")
                            search_btn = gr.Button("🚀 一键搜题", variant="primary")
                    with gr.Column():
                        ocr_result = gr.Textbox(label="识别结果（可编辑修正）", lines=8, interactive=True, placeholder="识别结果将显示在这里，您可以编辑修正后再进行搜题")
                        search_output = gr.Textbox(label="搜索结果", lines=15, interactive=False)

                ocr_btn.click(
                    fn=handle_ocr,
                    inputs=[image_input],
                    outputs=[ocr_result],
                    show_progress=True
                )

                search_btn.click(
                    fn=handle_search,
                    inputs=[image_input],
                    outputs=[search_output],
                    show_progress=True
                )

                gr.Markdown("💡 **使用提示：** 先点击「识别题目」获取识别结果，如有错误可手动修正，然后点击「一键搜题」进行分析解答")

            with gr.TabItem("🌐 语言互译"):
                with gr.Row():
                    with gr.Column():
                        text_input = gr.Textbox(label="输入要翻译的文本", lines=5)
                        with gr.Row():
                            source_lang = gr.Dropdown(
                                choices=["中文", "英语", "日语", "韩语", "法语", "德语", "西班牙语", "俄语"],
                                label="源语言",
                                value="中文"
                            )
                            gr.Markdown("→")
                            target_lang = gr.Dropdown(
                                choices=["英语", "日语", "韩语", "法语", "德语", "西班牙语", "俄语", "中文"],
                                label="目标语言",
                                value="英语"
                            )
                        translate_btn = gr.Button("翻译", variant="primary")
                    with gr.Column():
                        translate_output = gr.Textbox(label="翻译结果", lines=10, interactive=False)

                translate_btn.click(
                    fn=translate_text,
                    inputs=[text_input, source_lang, target_lang],
                    outputs=[translate_output],
                    show_progress=True
                )

            with gr.TabItem("💬 学科对话答疑"):
                with gr.Row():
                    with gr.Column(scale=1, min_width=150):
                        gr.Image(
                            value=avatar_path,
                            label="小帮老师",
                            interactive=False,
                            show_label=False,
                            height=180
                        )

                        gr.Markdown(
                            "👋 **Hi~ 我是小帮**\n\n你的专属学习助手\n\n📚 擅长各学科答疑\n💡 提供学习建议",
                            elem_classes="avatar-card"
                        )

                        with gr.Column(variant="panel"):
                            gr.Markdown("**💡 快捷问题**")
                            q1_btn = gr.Button("学习中怎样避免拖延症？", variant="secondary", size="sm")
                            q2_btn = gr.Button("如何高效记课堂笔记？", variant="secondary", size="sm")
                            q3_btn = gr.Button("怎样提高数学解题能力？", variant="secondary", size="sm")

                        with gr.Column(variant="panel"):
                            gr.Markdown("**📊 对话统计**")
                            chat_stats = gr.Markdown("对话次数: 0\n\n当前话题: 无")

                        clear_btn = gr.Button("清除对话", variant="stop", size="sm")

                    with gr.Column(scale=4):
                        chatbot = gr.Chatbot(
                            label="对话记录",
                            height=500,
                            avatar_images=(None, avatar_path)
                        )

                        with gr.Row():
                            message_input = gr.Textbox(
                                label="输入问题",
                                lines=2,
                                placeholder="输入你的问题...",
                                scale=8
                            )
                            send_btn = gr.Button("发送", variant="primary", scale=1)

                q1_btn.click(
                    fn=handle_quick_question_1,
                    inputs=[chatbot],
                    outputs=[chatbot, message_input, chat_stats],
                    show_progress=True
                )

                q2_btn.click(
                    fn=handle_quick_question_2,
                    inputs=[chatbot],
                    outputs=[chatbot, message_input, chat_stats],
                    show_progress=True
                )

                q3_btn.click(
                    fn=handle_quick_question_3,
                    inputs=[chatbot],
                    outputs=[chatbot, message_input, chat_stats],
                    show_progress=True
                )

                send_btn.click(
                    fn=chat_with_ai,
                    inputs=[message_input, chatbot],
                    outputs=[chatbot, message_input, chat_stats],
                    show_progress=True
                )

                message_input.submit(
                    fn=chat_with_ai,
                    inputs=[message_input, chatbot],
                    outputs=[chatbot, message_input, chat_stats],
                    show_progress=True
                )

                clear_btn.click(
                    fn=lambda: (None, None, "对话次数: 0\n\n当前话题: 无"),
                    outputs=[chatbot, message_input, chat_stats]
                )

        with gr.TabItem("⚙️ 配置说明"):
            gr.Markdown("""## ⚙️ 配置说明

### 📋 配置状态：""")

            for warning in warnings:
                gr.Markdown(f"- {warning}")

            gr.Markdown("""
### 📝 配置方式

请在环境变量中配置以下参数：

| 参数 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API密钥 |
| `OPENAI_BASE_URL` | API基础地址（可选，默认官方地址） |
| `OPENAI_MODEL` | 使用的模型名称（可选，默认gpt-4o-mini） |
| `LLM_TIMEOUT` | LLM调用超时时间（可选，默认120秒） |
| `LLM_MAX_RETRIES` | 重试次数（可选，默认3次） |

### 🎯 功能介绍

1. **📷 OCR拍照搜题**：上传题目图片，系统自动识别文字并调用AI进行解答
2. **🌐 语言互译**：支持中、英、日、韩、法、德、西、俄等多语言互译
3. **💬 学科对话答疑**：与AI学习助手进行学科知识对话

### 🚀 使用步骤

1. 配置环境变量（.env文件）
2. 启动应用：`python ai_study_app.py`
3. 访问 http://localhost:7860
4. 上传题目图片或输入问题

### ⚠️ 注意事项

- 请确保网络畅通
- API密钥需要有足够的余额
- 建议上传清晰的题目图片以提高识别准确率
""")

    demo.launch(
        server_name="0.0.0.0",
        server_port=CONFIG["gradio_port"],
        share=False,
        debug=False
    )


if __name__ == "__main__":
    main()