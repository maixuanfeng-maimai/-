from typing import List, Dict, Generator
from openai import OpenAI, APIError, APIConnectionError, APITimeoutError
from .config import CONFIG
from .logging_config import logger


def get_openai_client():
    api_key = CONFIG["openai_api_key"]
    
    if not api_key:
        raise ValueError("未配置OPENAI_API_KEY环境变量！\n请设置环境变量或创建.env文件。\n示例: OPENAI_API_KEY=your_api_key")
    
    if api_key in ("your_api_key_here", "sk-", "your-key-here", "api_key"):
        raise ValueError("API密钥未正确配置！\n当前使用的是占位符密钥，请编辑.env文件替换为真实的API密钥。\n示例: OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx")
    
    if len(api_key) < 10:
        raise ValueError("API密钥长度不足！\n请检查.env文件中的OPENAI_API_KEY是否正确配置。")
    
    return OpenAI(
        api_key=api_key,
        base_url=CONFIG["openai_base_url"],
        timeout=CONFIG["llm_timeout"]
    )


def sanitize_response(content: str) -> str:
    import re
    
    clean = content
    
    clean = re.sub(r'<[^>]+>', '', clean)
    
    clean = re.sub(r'&[a-zA-Z]+;', '', clean)
    
    clean = re.sub(r'\\\(', '', clean)
    clean = re.sub(r'\\\)', '', clean)
    clean = re.sub(r'\\\[', '', clean)
    clean = re.sub(r'\\\]', '', clean)
    
    clean = re.sub(r'尻', 'x', clean)
    
    clean = re.sub(r'([a-zA-Z])\1+\^?', r'\1', clean)
    
    clean = re.sub(r'\^\s*(?=\s)', '', clean)
    
    clean = re.sub(r'([。，；、！？])\1+', r'\1', clean)
    
    clean = re.sub(r'([一-龥])\1{3,}', r'\1', clean)
    
    clean = re.sub(r'([a-zA-Z])\1{5,}', r'\1', clean)
    
    clean = re.sub(r'(\d)\1{5,}', r'\1', clean)
    
    clean = re.sub(r'[ \t]+', ' ', clean)
    
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    
    clean = re.sub(r'^\s+|\s+$', '', clean)
    
    return clean


def call_llm(messages: List[Dict[str, str]], max_tokens: int = 1024, temperature: float = 0.0, model: str = None) -> Generator[str, None, None]:
    import time
    client = get_openai_client()
    retry_count = 0
    
    use_model = model or CONFIG["openai_model"]

    logger.debug(f"LLM调用参数: model={use_model}, max_tokens={max_tokens}, temperature={temperature}")
    logger.debug(f"LLM调用消息: {str(messages)[:500]}")

    while retry_count < CONFIG["llm_max_retries"]:
        try:
            start_time = time.time()
            stream = client.chat.completions.create(
                model=use_model,
                messages=messages,
                max_tokens=max_tokens,
                stream=True,
                temperature=temperature,
                top_p=0.8,
                frequency_penalty=0.3,
                presence_penalty=0.0
            )

            full_response = ""
            first_chunk_received = False
            in_think_block = False
            think_chars_skipped = 0
            
            for chunk in stream:
                delta = chunk.choices[0].delta
                content = delta.content or ""
                
                if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                    think_chars_skipped += len(delta.reasoning_content)
                    logger.debug(f"跳过reasoning_content: {delta.reasoning_content[:30]}...")
                    continue
                
                if not first_chunk_received and content:
                    logger.debug(f"LLM首字符: '{content[:5]}' (ASCII: {[ord(c) for c in content[:5]]})")
                    first_chunk_received = True
                
                if in_think_block:
                    close_idx = content.find('</think>')
                    if close_idx != -1:
                        in_think_block = False
                        content = content[close_idx + 8:]
                    else:
                        think_chars_skipped += len(content)
                        continue
                
                if not in_think_block:
                    open_idx = content.find('<think>')
                    if open_idx != -1:
                        in_think_block = True
                        think_chars_skipped += len(content) - open_idx
                        content = content[:open_idx]
                
                if content:
                    logger.debug(f"LLM chunk: '{content[:50]}' ({len(content)} chars)")
                    full_response += content
                    yield content

            full_response = sanitize_response(full_response)
            
            elapsed_time = time.time() - start_time
            
            if think_chars_skipped > 0:
                logger.debug(f"跳过内部思考内容: {think_chars_skipped} 字符")
            
            if not full_response.strip():
                raise ValueError("LLM返回空内容")
            
            if len(full_response) > 100:
                unique_chars = len(set(full_response[:100]))
                if unique_chars < 5:
                    logger.error(f"LLM返回疑似乱码: 前100字符仅{unique_chars}种不同字符")
            
            logger.debug(f"LLM返回内容前200字符: '{full_response[:200]}'")
            logger.info(f"LLM调用成功，返回 {len(full_response)} 字符，耗时 {elapsed_time:.2f}s")
            
            return

        except APITimeoutError:
            retry_count += 1
            logger.warning(f"LLM超时重试 {retry_count}/{CONFIG['llm_max_retries']}")
            yield f"\n\n🔴 网络超时，请稍候重试... ({retry_count}/{CONFIG['llm_max_retries']})"
            time.sleep(2 * retry_count)
        except APIConnectionError:
            retry_count += 1
            logger.warning(f"LLM连接重试 {retry_count}/{CONFIG['llm_max_retries']}")
            yield f"\n\n🔴 网络连接失败，请检查网络设置... ({retry_count}/{CONFIG['llm_max_retries']})"
            time.sleep(2 * retry_count)
        except APIError as e:
            retry_count += 1
            logger.warning(f"LLM API错误重试 {retry_count}/{CONFIG['llm_max_retries']}: {str(e)}")
            yield f"\n\n🔴 API调用异常: {str(e)} ({retry_count}/{CONFIG['llm_max_retries']})"
            time.sleep(2 * retry_count)
        except ValueError as e:
            logger.error(f"LLM配置错误: {str(e)}")
            yield f"\n\n🔴 配置错误: {str(e)}"
            return
        except Exception as e:
            retry_count += 1
            logger.warning(f"LLM未知错误重试 {retry_count}/{CONFIG['llm_max_retries']}: {str(e)}")
            yield f"\n\n🔴 未知错误: {str(e)} ({retry_count}/{CONFIG['llm_max_retries']})"
            time.sleep(2 * retry_count)

    logger.error("LLM调用失败，已达到最大重试次数")
    yield "\n\n🔴 服务暂时不可用，请稍后重试或联系管理员"