import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.ocr_utils import correct_math_symbols, detect_subject, clean_text, is_garbage_text


class TestCorrectMathSymbols:
    def test_math_expression_conversion(self):
        assert correct_math_symbols('解方程 2x 加 5 等于 15') == '解方程 2x+5=15'
        assert correct_math_symbols('3 乘 4 等于 12') == '3×4=12'
        assert correct_math_symbols('5 减 2 等于 3') == '5-2=3'
        assert correct_math_symbols('10 除 2 等于 5') == '10÷2=5'
        assert correct_math_symbols('x 的平方 减 4') == 'x 的平方 -4'
        assert correct_math_symbols('根号25') == '√25'
        assert correct_math_symbols('x 不等于 y') == 'x≠y'
        assert correct_math_symbols('3 大于等于 2') == '3≥2'
        assert correct_math_symbols('2 小于等于 3') == '2≤3'

    def test_chinese_vocabulary_protection(self):
        assert correct_math_symbols('增加5个苹果') == '增加5个苹果'
        assert correct_math_symbols('乘客有3人') == '乘客有3人'
        assert correct_math_symbols('正确答案是A') == '正确答案是A'
        assert correct_math_symbols('负责计算') == '负责计算'
        assert correct_math_symbols('减少不必要的开支') == '减少不必要的开支'
        assert correct_math_symbols('加强管理') == '加强管理'
        assert correct_math_symbols('乘法口诀') == '乘法口诀'
        assert correct_math_symbols('加法运算') == '加法运算'

    def test_simple_mappings(self):
        assert '√' in correct_math_symbols('V25')
        assert '√' in correct_math_symbols('v25')
        assert '÷' in correct_math_symbols('10 // 2')
        assert '×' in correct_math_symbols('3 * 4')
        assert '²' in correct_math_symbols('x^2')
        assert '³' in correct_math_symbols('y^3')
        assert 'π' in correct_math_symbols('圆周率')
        assert 'π' in correct_math_symbols('pi')

    def test_empty_and_boundary(self):
        assert correct_math_symbols('') == ''
        assert correct_math_symbols('   ') == ''
        assert correct_math_symbols('abc') == 'abc'
        assert correct_math_symbols('123') == '123'


class TestDetectSubject:
    def test_math_detection(self):
        assert detect_subject('解方程 2x + 5 = 15') == '数学'
        assert detect_subject('求圆的面积') == '数学'
        assert detect_subject('x² + y² = r²') == '数学'
        assert detect_subject('计算 sin(30°)') == '数学'
        assert detect_subject('求导数 f(x) = x²') == '数学'
        assert detect_subject('2 + 3 = 5') == '数学'
        assert detect_subject('解方程') == '数学'
        assert detect_subject('求极限') == '数学'

    def test_english_detection(self):
        assert detect_subject('英语语法填空') == '英语'
        assert detect_subject('完形填空') == '英语'
        assert detect_subject('vocabulary test') == '英语'
        assert detect_subject('Are you free this evening?') == '英语'
        assert detect_subject('Shall we meet at half past two?') == '英语'
        assert detect_subject('A.have you free B.are you free C.you have free D.were you free') == '英语'
        assert detect_subject('Meimei, this evening I think so. Why?') == '英语'
        assert detect_subject('English reading comprehension') == '英语'
        assert detect_subject('Choose the correct answer: A) apple B) banana C) orange') == '英语'

    def test_chinese_detection(self):
        assert detect_subject('语文作文') == '语文'
        assert detect_subject('文言文翻译') == '语文'
        assert detect_subject('诗词鉴赏') == '语文'
        assert detect_subject('阅读理解') == '语文'

    def test_chemistry_detection(self):
        assert detect_subject('化学方程式配平') == '化学'
        assert detect_subject('氧化还原反应') == '化学'
        assert detect_subject('溶液浓度计算') == '化学'

    def test_physics_detection(self):
        assert detect_subject('物理力学题目') == '物理'
        assert detect_subject('电路分析') == '物理'
        assert detect_subject('速度计算') == '物理'

    def test_history_detection(self):
        assert detect_subject('唐朝的建立') == '历史'
        assert detect_subject('鸦片战争') == '历史'
        assert detect_subject('清朝历史') == '历史'

    def test_geography_detection(self):
        assert detect_subject('气候分析') == '地理'
        assert detect_subject('洋流分布') == '地理'

    def test_biology_detection(self):
        assert detect_subject('细胞结构') == '生物'
        assert detect_subject('DNA复制') == '生物'

    def test_empty_and_boundary(self):
        assert detect_subject('') == '综合学科'
        assert detect_subject('   ') == '综合学科'
        assert detect_subject('未知内容') == '综合学科'


class TestCleanText:
    def test_escape_sequence_removal(self):
        assert clean_text('hello\\x41world') == 'hello world'
        assert clean_text('\\n\\t\\r') == ''
        assert clean_text('a\\nb\\tc') == 'a b c'

    def test_control_characters_removal(self):
        assert clean_text('hello\x00world') == 'hello world'
        assert clean_text('hello\x7fworld') == 'hello world'

    def test_whitespace_compression(self):
        assert clean_text('hello   world') == 'hello world'
        assert clean_text('  hello   world  ') == 'hello world'
        assert clean_text('hello\n\nworld') == 'hello world'

    def test_preserve_math_content(self):
        assert clean_text('2x + 5 = 15') == '2x + 5 = 15'
        assert clean_text('x² - 4 = 0') == 'x² - 4 = 0'
        assert clean_text('sin(30°)') == 'sin(30°)'

    def test_empty_and_boundary(self):
        assert clean_text('') == ''
        assert clean_text('   ') == ''


class TestIsGarbageText:
    def test_garbage_detection(self):
        assert is_garbage_text('') == True
        assert is_garbage_text('   ') == True
        assert is_garbage_text('abc') == False
        assert is_garbage_text('123') == False

    def test_chinese_detection(self):
        assert is_garbage_text('解方程') == False
        assert is_garbage_text('中文内容') == False

    def test_math_expression(self):
        assert is_garbage_text('2x + 5 = 15') == False
        assert is_garbage_text('sin(x)') == False

    def test_english_words(self):
        assert is_garbage_text('hello world') == False
        assert is_garbage_text('the quick brown fox') == False