from .config import CONFIG
from .logging_config import logger
from .ocr_utils import ocr_image, init_ocr
from .llm_service import call_llm
from .chat_service import chat_with_ai, translate_text, get_chat_stats, analyze_topic