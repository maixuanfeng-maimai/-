from typing import List, Dict, Generator, Tuple
from .llm_service import call_llm
from .logging_config import logger
from .config import OUTPUT_FORMAT_CONSTRAINT_SIMPLE, CONFIG


def analyze_topic(messages: List[dict]) -> str:
    user_messages = [m['content'] for m in messages if isinstance(m, dict) and m.get('role') == 'user']
    if len(user_messages) == 0:
        return "无"

    keywords = {
        '数学': ['数学', '几何', '代数', '方程', '函数', '导数', '积分', '三角函数'],
        '物理': ['物理', '力学', '运动', '能量', '电场', '磁场', '相对论'],
        '化学': ['化学', '元素', '反应', '分子', '原子', '有机物', '无机物'],
        '语文': ['语文', '作文', '阅读', '诗词', '文言文', '语法'],
        '英语': ['英语', '语法', '词汇', '阅读', '写作', '完形', '翻译'],
        '生物': ['生物', '细胞', '遗传', '进化', '生态', 'DNA', '蛋白质'],
        '历史': ['历史', '朝代', '战争', '人物', '事件', '文明'],
        '地理': ['地理', '气候', '地形', '洋流', '城市', '资源'],
        '计算机': ['计算机', '编程', '算法', '数据结构', '网络', 'Python'],
        '学习方法': ['学习', '复习', '记忆', '效率', '笔记', '拖延'],
    }

    for topic, kw_list in keywords.items():
        for kw in kw_list:
            for msg in user_messages:
                if kw in msg:
                    return topic

    return "综合学科"


def get_chat_stats(history: List[dict]) -> str:
    user_count = sum(1 for m in history if isinstance(m, dict) and m.get('role') == 'user')
    topic = analyze_topic(history)
    return f"对话次数: {user_count}\n\n当前话题: {topic}"


def chat_with_ai(message: str, history: List[dict]) -> Generator[Tuple[List[dict], str, str], None, None]:
    if not message.strip():
        yield history, "", get_chat_stats(history)
        return

    system_prompt = "你是一个专业的全能学科辅导老师，名字叫小帮。你擅长解答各种学科问题，包括数学、物理、化学、语文、英语、生物、历史、地理和计算机。请用清晰、易懂的方式解答用户的问题。对于数学公式，请使用标准的数学符号表示。回答要友好、亲切，像一个耐心的辅导老师。请根据之前的对话历史提供上下文相关的回答。" + OUTPUT_FORMAT_CONSTRAINT_SIMPLE

    llm_messages = [{"role": "system", "content": system_prompt}]

    for msg in history:
        if isinstance(msg, dict):
            if 'role' in msg and 'content' in msg:
                llm_messages.append({"role": msg['role'], "content": msg['content']})
            elif 'user' in msg:
                llm_messages.append({"role": "user", "content": msg['user']})
                if 'assistant' in msg:
                    llm_messages.append({"role": "assistant", "content": msg['assistant']})
        elif isinstance(msg, tuple) and len(msg) == 2:
            llm_messages.append({"role": "user", "content": msg[0]})
            llm_messages.append({"role": "assistant", "content": msg[1]})

    llm_messages.append({"role": "user", "content": message})

    new_history = history.copy()
    new_history.append({"role": "user", "content": message})
    new_history.append({"role": "assistant", "content": ""})

    logger.info(f"用户提问: {message[:50]}...")

    for chunk in call_llm(llm_messages, model=CONFIG["openai_model_chat"]):
        new_history[-1]["content"] += chunk
        yield new_history, "", get_chat_stats(new_history)


def translate_text(text: str, source_language: str, target_language: str) -> Generator[str, None, None]:
    if not text.strip():
        yield "请输入要翻译的内容"
        return

    current_text = f"正在将{source_language}翻译成{target_language}..."
    yield current_text

    messages = [
        {"role": "system", "content": "你是一个专业的多语言翻译助手。请准确翻译用户提供的文本，保持学科术语的准确性。" + OUTPUT_FORMAT_CONSTRAINT_SIMPLE},
        {"role": "user", "content": f"请将以下{source_language}文本翻译成{target_language}：\n\n{text}"}
    ]

    logger.info(f"翻译请求: {source_language} -> {target_language}, 文本长度: {len(text)}")

    for chunk in call_llm(messages, model=CONFIG["openai_model_chat"]):
        current_text += chunk
        yield current_text