import re
import numpy as np
from typing import Tuple
from PIL import Image, ImageEnhance, ImageFilter
from .config import CONFIG, MATH_SYMBOL_CORRECTIONS
from .logging_config import logger

ocr = None
_ocr_initialized = False


def preprocess_image(image: Image.Image) -> Image.Image:
    img = image.convert('RGB')
    
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.3)
    
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(1.5)
    
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(1.1)
    
    img = img.filter(ImageFilter.MedianFilter(size=3))
    
    img = img.filter(ImageFilter.SHARPEN)
    
    width, height = img.size
    if width < 800 or height < 600:
        scale_factor = max(800 / width, 600 / height)
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    return img


def advanced_preprocess(image: Image.Image) -> Image.Image:
    img = image.convert('L')
    
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    
    img = img.filter(ImageFilter.MedianFilter(size=3))
    
    img = img.filter(ImageFilter.SHARPEN)
    
    return img


def is_garbage_text(text: str) -> bool:
    if not text or not text.strip():
        return True
    total_chars = len(text.strip())
    if total_chars < 3:
        return True

    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
    english_words = re.findall(r'[a-zA-Z]+', text)
    digit_chars = re.findall(r'[0-9]', text)
    math_symbols = re.findall(r'[+\-*/=()\[\]{}<>^√πθλμσφω∫∑∏∞∂∆]', text)

    common_words = {'the', 'and', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                    'could', 'should', 'may', 'might', 'must', 'shall', 'can',
                    'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for',
                    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
                    'during', 'before', 'after', 'above', 'below', 'between',
                    'under', 'again', 'further', 'then', 'once', 'here', 'there',
                    'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
                    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
                    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but',
                    'if', 'or', 'because', 'until', 'while', 'this', 'that',
                    'these', 'those', 'what', 'which', 'who', 'whom', 'it', 'he',
                    'she', 'they', 'we', 'you', 'i', 'a', 'an', 'his', 'her',
                    'their', 'our', 'my', 'your', 'its', 'with', 'from', 'that',
                    'when', 'make', 'than', 'first', 'any', 'good', 'give', 'new',
                    'take', 'people', 'into', 'year', 'time', 'look', 'only', 'come',
                    'over', 'think', 'also', 'back', 'after', 'use', 'two', 'little',
                    'more', 'work', 'right', 'down', 'should', 'each', 'about', 'way',
                    'long', 'need', 'while', 'still', 'under', 'never', 'last', 'place',
                    'after', 'same', 'another', 'around', 'always', 'know', 'than',
                    'because', 'give', 'most', 'even', 'through', 'just', 'which',
                    'great', 'could', 'them', 'other', 'its', 'equation', 'solve',
                    'find', 'calculate', 'determine', 'prove', 'show', 'given',
                    'let', 'assume', 'suppose', 'known', 'unknown', 'value',
                    'values', 'variable', 'variables', 'function', 'functions',
                    'point', 'points', 'line', 'lines', 'angle', 'angles',
                    'triangle', 'triangles', 'circle', 'circles', 'square',
                    'rectangle', 'area', 'volume', 'length', 'height', 'width',
                    'radius', 'diameter', 'perimeter', 'side', 'sides', 'vertex',
                    'vertices', 'center', 'centre', 'axis', 'axes', 'origin',
                    'coordinate', 'coordinates', 'vector', 'vectors', 'matrix',
                    'matrices', 'sum', 'product', 'difference', 'quotient',
                    'ratio', 'proportion', 'percentage', 'percent', 'degree',
                    'degrees', 'radian', 'radians', 'sin', 'cos', 'tan', 'log',
                    'ln', 'exp', 'sqrt', 'root', 'power', 'exponent', 'base',
                    'logarithm', 'derivative', 'integral', 'limit', 'series',
                    'sequence', 'equation', 'equations', 'inequality', 'identity',
                    'formula', 'formulas', 'theorem', 'corollary', 'lemma'}

    valid_word_count = 0
    for word in english_words:
        if word.lower() in common_words:
            valid_word_count += 1

    has_chinese = len(chinese_chars) > 0
    has_math_symbols = len(math_symbols) > 0
    has_digits = len(digit_chars) > 0

    if has_chinese:
        return False
    if has_math_symbols and has_digits:
        return False
    if len(english_words) >= 2:
        valid_ratio = valid_word_count / len(english_words)
        if valid_ratio >= 0.3:
            return False
        if len(english_words) >= 10 and valid_word_count >= 3:
            return False
        if len(english_words) >= 20 and valid_word_count >= 5:
            return False
    if len(english_words) >= 30:
        return False
    if len(english_words) >= 5 and valid_word_count == 0:
        return True
    return False


def correct_math_symbols(text: str) -> str:
    corrected = text
    
    boundary_prefix = r'(?<![^\s\d+\-×÷=()\[\]{}<>^a-zA-Z])\s*'
    boundary_suffix = r'\s*(?![^\s\d+\-×÷=()\[\]{}<>^a-zA-Z])'
    
    chinese_op_patterns = [
        ('除以', '÷'),
        ('根号', '√'),
        ('平方根', '√'),
        ('不等于', '≠'),
        ('大于等于', '≥'),
        ('小于等于', '≤'),
        ('等于', '='),
        ('加', '+'),
        ('减', '-'),
        ('乘', '×'),
        ('除', '÷'),
        ('平方', '²'),
        ('立方', '³'),
    ]
    
    for old, new in chinese_op_patterns:
        pattern = boundary_prefix + re.escape(old) + boundary_suffix
        corrected = re.sub(pattern, new, corrected)
    
    simple_mappings = [
        ('V', '√'),
        ('v', '√'),
        ('//', '÷'),
        ('\\', '÷'),
        ('*', '×'),
        ('**', '²'),
        ('y2', 'y²'),
        ('y3', 'y³'),
        ('z2', 'z²'),
        ('z3', 'z³'),
        ('2次方', '²'),
        ('3次方', '³'),
        ('4次方', '⁴'),
        ('次方', '^'),
        ('π', 'π'),
        ('pi', 'π'),
        ('圆周率', 'π'),
    ]
    
    for old, new in simple_mappings:
        corrected = corrected.replace(old, new)
    
    for old, new in MATH_SYMBOL_CORRECTIONS:
        corrected = corrected.replace(old, new)
    
    corrected = re.sub(r'(x)\1+', r'\1', corrected)
    
    corrected = re.sub(r'(x)\s*(=)', r'\1\2', corrected)
    
    corrected = re.sub(r'\s+', ' ', corrected)
    
    return corrected.strip()


def clean_text(text: str) -> str:
    cleaned = text
    
    cleaned = re.sub(r'\\[xX][0-9a-fA-F]{2}', ' ', cleaned)
    
    cleaned = re.sub(r'\\[0-7]{1,3}', ' ', cleaned)
    
    cleaned = re.sub(r'\\[ntrfvb]', ' ', cleaned)
    
    cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', ' ', cleaned)
    
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    return cleaned.strip()


def detect_subject(text: str) -> str:
    text_lower = text.lower()
    text_clean = re.sub(r'[^\w\u4e00-\u9fff+\-×÷=()\[\]{}<>^√π²³⁴⁵⁶⁷⁸⁹]', '', text)
    
    eng_count = len(re.findall(r'[a-zA-Z]', text))
    total_chars = len(text.strip()) if text.strip() else 1
    eng_ratio = eng_count / total_chars
    
    digit_count = len(re.findall(r'[0-9]', text))
    math_sym_count = len(re.findall(r'[+\-×÷=()\[\]{}<>^√π²³⁴⁵⁶⁷⁸⁹]', text))
    chinese_count = len(re.findall(r'[\u4e00-\u9fff]', text))
    
    english_keywords = ['英语', '语法', '词汇', '完形', '填空']
    chinese_keywords = ['语文', '文言文', '诗词', '诗歌', '阅读理解', '现代文', '作文']
    chemistry_keywords = ['化学', '反应', '分子', '原子', '元素', '有机', '无机', '溶液', '浓度', 'pH', '氧化', '还原', '方程式']
    physics_keywords = ['物理', '力学', '运动', '能量', '电场', '磁场', '电路', '光学', '速度', '加速度', '力', '功', '功率']
    biology_keywords = ['生物', '细胞', '遗传', 'DNA', '蛋白质', '生态']
    geography_keywords = ['地理', '气候', '地形', '洋流', '城市']
    history_keywords = ['历史', '朝代', '战争', '皇帝', '唐朝', '宋朝', '明朝', '清朝', '汉朝', '三国', '战国', '春秋', '秦汉', '隋唐', '宋元', '明清', '近代史', '古代史', '近代史']
    math_keywords = ['方程', '函数', '导数', '积分', '极限', '向量', '矩阵', '概率', '统计', '几何', '三角', '数列', '不等式', 'sin', 'cos', 'tan', 'log', 'sqrt', 'lim', '∫', '∑', 'π', '面积', '体积', '周长', '边长', '半径', '直径', '角度', '弧度', '斜率', '对称', '平行', '垂直', '相似', '全等']
    
    for keyword in english_keywords:
        if keyword in text:
            return '英语'
    for keyword in chinese_keywords:
        if keyword in text:
            return '语文'
    for keyword in chemistry_keywords:
        if keyword in text:
            return '化学'
    for keyword in physics_keywords:
        if keyword in text:
            return '物理'
    for keyword in biology_keywords:
        if keyword in text:
            return '生物'
    for keyword in geography_keywords:
        if keyword in text:
            return '地理'
    for keyword in history_keywords:
        if keyword in text:
            return '历史'
    
    for keyword in math_keywords:
        if keyword.lower() in text_lower:
            return '数学'
    
    has_var = bool(re.search(r'[xyzXYZ]\s*[+\-×÷=]', text_clean))
    has_var_sup = bool(re.search(r'[xyzXYZ][²³⁴⁵⁶⁷⁸⁹]?\s*[+\-×÷=]', text_clean))
    has_expr = bool(re.search(r'(\d)\s*[+\-×÷]\s*(\d)', text_clean))
    has_eq = bool(re.search(r'.*[+\-×÷]\s*=\s*.*', text_clean))
    has_sup = bool(re.search(r'[xyzXYZ][²³⁴⁵⁶⁷⁸⁹]', text_clean))
    
    score = 0
    if has_var or has_var_sup:
        score += 3
    if has_expr:
        score += 2
    if has_eq:
        score += 3
    if has_sup:
        score += 2
    
    is_english_dominant = eng_ratio > 0.3 and chinese_count == 0
    
    if is_english_dominant:
        if score >= 6:
            return '数学'
        if digit_count >= 5 and math_sym_count >= 2:
            return '数学'
        return '英语'
    
    if score >= 4:
        return '数学'
    if digit_count >= 3 and math_sym_count >= 1:
        return '数学'
    
    if eng_ratio > 0.3:
        return '英语'
    
    return '综合学科'


def detect_question_type(text: str) -> str:
    if re.search(r'[（(][ABCD][）)]\s*[．.、]\s*[^\n]+', text):
        if re.search(r'[（(][ABCD][）)]\s*[．.、]\s*[^\n]+', text):
            if '下列说法' in text or '正确的是' in text or '错误的是' in text:
                return '选择题(判断题)'
            return '选择题'
    
    if re.search(r'[（(][一二三四五六七八九十][）)]\s*[^\n]+', text) or re.search(r'\d+[．.、]\s*[^\n]+', text):
        lines = text.split('\n')
        answer_lines = 0
        for line in lines:
            if re.search(r'[（(][ABCD][）)]\s*[^\n]+', line):
                answer_lines += 1
        if answer_lines >= 2:
            return '选择题'
    
    if re.search(r'填空|填写|填入', text):
        return '填空题'
    
    if re.search(r'解答|解答题|求解|求下列', text):
        return '解答题'
    
    if re.search(r'计算|求值|化简|证明', text):
        return '计算题'
    
    if re.search(r'翻译|英译汉|汉译英', text):
        return '翻译题'
    
    return '综合题'


def init_ocr(force=False):
    global ocr, _ocr_initialized
    if _ocr_initialized and not force:
        logger.debug("OCR引擎已初始化，跳过重复初始化")
        return True, "OCR引擎已初始化"
    
    try:
        import paddleocr as ocr_module
        version = ocr_module.__version__
        major_version = int(version.split('.')[0])

        ocr_params = {"lang": CONFIG["ocr_lang"]}

        if major_version >= 3:
            ocr_params["use_textline_orientation"] = CONFIG["ocr_use_textline_orientation"]
        else:
            ocr_params["use_angle_cls"] = CONFIG["ocr_use_angle_cls"]
            ocr_params["show_log"] = False

        ocr = ocr_module.PaddleOCR(**ocr_params)
        _ocr_initialized = True
        logger.info(f"OCR初始化成功 (版本: {version})")
        return True, f"OCR初始化成功 (版本: {version})"
    except Exception as e:
        logger.error(f"OCR初始化失败: {str(e)}")
        return False, f"OCR初始化失败: {str(e)}"


def is_ocr_initialized():
    return _ocr_initialized


def ocr_image(image: Image.Image) -> Tuple[str, str]:
    if ocr is None:
        success, msg = init_ocr()
        if not success:
            return "", msg

    try:
        import paddleocr as ocr_module
        version = ocr_module.__version__
        major_version = int(version.split('.')[0])
        logger.debug(f"PaddleOCR版本: {version}, 主版本: {major_version}")

        preprocessed_img = preprocess_image(image)
        img_np = np.array(preprocessed_img)
        logger.debug(f"图像形状: {img_np.shape}, 数据类型: {img_np.dtype}")

        if major_version >= 3:
            result = ocr.predict(img_np)
        else:
            result = ocr.ocr(img_np, cls=True)

        if not result:
            logger.warning("未识别到文字内容，尝试高级预处理...")
            
            advanced_img = advanced_preprocess(image)
            advanced_np = np.array(advanced_img)
            
            if major_version >= 3:
                result = ocr.predict(advanced_np)
            else:
                result = ocr.ocr(advanced_np, cls=True)

        if not result:
            logger.warning("高级预处理后仍未识别到文字内容")
            return "", "未识别到文字内容"

        text_lines = []

        if major_version >= 3:
            logger.debug(f"PaddleOCR v3+ 返回类型: {type(result)}")
            logger.debug(f"PaddleOCR v3+ 返回长度: {len(result) if hasattr(result, '__len__') else 'N/A'}")
            
            for i, item in enumerate(result[:3]):
                logger.debug(f"结果元素[{i}]类型: {type(item)}")
                if isinstance(item, dict):
                    logger.debug(f"结果元素[{i}]键: {list(item.keys())}")
                    for key, val in item.items():
                        if isinstance(val, (list, str)):
                            logger.debug(f"  {key}: {str(val)[:100]}")
            
            if isinstance(result, list) and len(result) > 0:
                ocr_result = result[0]
                
                if isinstance(ocr_result, dict):
                    if 'rec_texts' in ocr_result:
                        rec_texts = ocr_result['rec_texts']
                        if isinstance(rec_texts, list):
                            for text in rec_texts:
                                if isinstance(text, str):
                                    text_lines.append(text)
                                else:
                                    text_lines.append(str(text))
                        else:
                            text_lines.append(str(rec_texts))
                    elif 'text' in ocr_result:
                        text_lines = [ocr_result['text']]
                    elif 'data' in ocr_result:
                        if isinstance(ocr_result['data'], list):
                            for item in ocr_result['data']:
                                if isinstance(item, dict):
                                    if 'text' in item:
                                        text_lines.append(str(item['text']))
                                    elif 'rec_text' in item:
                                        text_lines.append(str(item['rec_text']))
                                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                                    text_lines.append(str(item[1]))
                                elif hasattr(item, 'text'):
                                    text_lines.append(item.text)
                        elif hasattr(ocr_result['data'], '__iter__') and not isinstance(ocr_result['data'], str):
                            for item in ocr_result['data']:
                                if hasattr(item, 'text'):
                                    text_lines.append(item.text)
                                elif isinstance(item, dict) and 'text' in item:
                                    text_lines.append(item['text'])
                elif hasattr(ocr_result, 'get'):
                    text_lines = ocr_result.get('rec_texts', [])
                elif hasattr(ocr_result, 'rec_texts'):
                    text_lines = ocr_result.rec_texts
                elif hasattr(ocr_result, 'text'):
                    text_lines = [ocr_result.text]
                elif isinstance(ocr_result, str):
                    text_lines = [ocr_result]
                else:
                    logger.error(f"无法解析PaddleOCR v3+返回结果: {str(ocr_result)[:200]}")
                    
                    try:
                        import json
                        result_str = json.dumps(result, default=str, ensure_ascii=False)
                        logger.error(f"原始OCR结果JSON: {result_str[:500]}")
                    except Exception as e:
                        logger.error(f"序列化OCR结果失败: {str(e)}")
                        
                    try:
                        text_lines = [str(item) for item in result if isinstance(item, str)]
                    except:
                        pass
        else:
            if isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], list):
                    for line in result[0]:
                        if isinstance(line, (list, tuple)) and len(line) >= 2:
                            if isinstance(line[1], (list, tuple)) and len(line[1]) >= 1:
                                text_lines.append(line[1][0])
                            else:
                                text_lines.append(str(line[1]))
                else:
                    for line in result:
                        if isinstance(line, (list, tuple)) and len(line) >= 2:
                            text_lines.append(str(line[1]))

        if not text_lines:
            logger.warning("未提取到任何文本行")
            return "", "未识别到文字内容"

        full_text = "\n".join(text_lines)
        logger.debug(f"原始识别文本: {full_text[:500]}")
        
        if not full_text.strip():
            return "", "未识别到文字内容"

        logger.debug(f"clean_text前: {full_text[:100]}")
        full_text = clean_text(full_text)
        logger.debug(f"clean_text后: {full_text[:100]}")
        
        logger.debug(f"correct_math_symbols前: {full_text[:100]}")
        full_text = correct_math_symbols(full_text)
        logger.debug(f"correct_math_symbols后: {full_text[:100]}")

        if is_garbage_text(full_text):
            logger.warning(f"识别结果被判定为乱码: {full_text[:100]}")
            return "", "识别结果为乱码，请尝试重新上传清晰的图片"

        logger.info(f"OCR识别成功，识别到 {len(full_text)} 字符")
        return full_text, "识别成功"
    except Exception as e:
        logger.error(f"OCR识别失败: {str(e)}")
        import traceback
        logger.error(f"异常堆栈: {traceback.format_exc()}")
        return "", f"OCR识别失败: {str(e)}"