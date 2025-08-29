import logging
import logging.handlers
import os
import re
import sys
import uuid
from pathlib import Path

# --- 配置项 ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
DEBUG_VERBOSE = os.getenv("DEBUG_VERBOSE", "false").lower() == "true"
LOG_MAX_LINE = int(os.getenv("LOG_MAX_LINE", 8192))  # 8KB
LOG_ROTATE_SIZE_MB = int(os.getenv("LOG_ROTATE_SIZE_MB", 5))
LOG_ROTATE_BACKUP_COUNT = 5
LOG_DIR = Path("logs")
CHUNK_DIR = LOG_DIR / "chunks"

# 确保日志目录存在
LOG_DIR.mkdir(exist_ok=True)
CHUNK_DIR.mkdir(exist_ok=True)

# --- 敏感信息掩码 ---
# 经过仔细修正的正则表达式字典
SENSITIVE_PATTERNS = {
    # Matches 'Authorization: Bearer <token>'
    re.compile(r'("Authorization"\s*:\s*"Bearer\s+)[^\"]*(")', re.IGNORECASE): r'\\1[MASKED]\\2',
    # Matches '"access_token": "<token>"'
    re.compile(r'("access_token"\s*:\s*")[^\"]*(")', re.IGNORECASE): r'\\1[MASKED]\\2',
    # Matches '"AKID...": "..."' or '"AKSecret...": "..."'
    re.compile(r'("AKID|AKSecret"\s*:\s*")[^\"]*(")', re.IGNORECASE): r'\\1[MASKED]\\2',
    # Matches 'cookie: ...' or 'cookie=...'
    re.compile(r'([\'"]?cookie[\'"]?\s*[:=]\s*[\'"]?)[^;]*', re.IGNORECASE): r'\\1[MASKED]',
    # Matches 'phone: ...' or 'phone=...' with at least 7 digits
    re.compile(r'([\'"]?phone[\'"]?\s*[:=]\s*[\'"]?)\d{7,}', re.IGNORECASE): r'\\1[MASKED]',
    # Matches email addresses
    re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'): r'[EMAIL_MASKED]',
}

def mask_sensitive_data(message: str) -> str:
    """对字符串中的敏感数据进行掩码处理"""
    for pattern, replacement in SENSITIVE_PATTERNS.items():
        message = pattern.sub(replacement, message)
    return message

def truncate_and_sample(data, field_name="data"):
    """
    对长数据（如Base64音频）进行截断和采样。
    返回一个包含长度和样本的字典。
    """
    if not isinstance(data, (str, bytes)):
        return data

    byte_len = len(data)
    result = {
        "byte_len": byte_len
    }

    if DEBUG_VERBOSE:
        sample_key = f"{field_name}_b64_sample" if isinstance(data, str) else f"{field_name}_bytes_sample"
        if isinstance(data, str):
            result[sample_key] = f"{data[:16]}...{data[-16:]}"
        else:
            result[sample_key] = f"{data[:16].hex()}...{data[-16:].hex()}"

    return result


class CustomFormatter(logging.Formatter):
    """
    自定义日志格式化器：
    1. 对敏感信息进行掩码。
    2. 对超长日志行进行截断，并将完整原文写入chunks目录。
    """
    def format(self, record):
        # 首先让父类完成基本格式化
        # 注意：我们在这里创建一个副本，以防格式化器被多个处理器共享时发生冲突
        record_copy = logging.makeLogRecord(record.__dict__)
        original_message = super().format(record_copy)
        
        # 1. 敏感信息掩码
        masked_message = mask_sensitive_data(original_message)
        
        # 2. 超长日志行截断
        if len(masked_message) > LOG_MAX_LINE:
            chunk_filename = CHUNK_DIR / f"{record.created}-{uuid.uuid4()}.logchunk"
            try:
                with open(chunk_filename, "w", encoding="utf-8") as f:
                    f.write(masked_message) # 写入掩码后的完整消息
                
                truncated_message = masked_message[:LOG_MAX_LINE - 50] + f"... [TRUNCATED] Full content in: {chunk_filename}"
                return truncated_message

            except Exception as e:
                # 如果写入chunk失败，也要保证主日志不中断
                return f"{masked_message[:LOG_MAX_LINE - 50]}... [TRUNCATED, chunk write failed: {e}]"
        
        return masked_message

def setup_logging():
    """
    配置全局日志记录器。
    """
    # 创建一个自定义格式化器实例
    formatter = CustomFormatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # 获取根记录器
    root_logger = logging.getLogger()
    # 清除所有现有的处理器，以防万一（例如在重载模块时）
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    root_logger.setLevel(logging.DEBUG)  # 设置根级别为DEBUG以捕获所有级别的消息

    # --- 文件处理器 (File Handler) ---
    # 负责将DEBUG及以上级别的日志写入文件，并进行轮转
    file_handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / "app.log",
        maxBytes=LOG_ROTATE_SIZE_MB * 1024 * 1024,
        backupCount=LOG_ROTATE_BACKUP_COUNT,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # --- 控制台处理器 (Console Handler) ---
    # 负责将指定级别（默认为INFO）及以上的日志输出到控制台
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(LOG_LEVEL)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # --- 打印生效的配置 ---
    logging.info("="*50)
    logging.info("Logging Service Initialized")
    logging.info(f"  Console Log Level: {LOG_LEVEL}")
    logging.info(f"  File Log Level:    DEBUG")
    logging.info(f"  Log File:          {LOG_DIR / 'app.log'}")
    logging.info(f"  Rotation Size:     {LOG_ROTATE_SIZE_MB} MB")
    logging.info(f"  Rotation Backups:  {LOG_ROTATE_BACKUP_COUNT}")
    logging.info(f"  Max Line Length:   {LOG_MAX_LINE} bytes")
    logging.info(f"  Verbose Debug:     {DEBUG_VERBOSE}")
    logging.info(f"  Long Log Chunks:   {CHUNK_DIR}")
    logging.info("="*50)

    # 禁用其他库（如werkzeug）的日志记录器，让我们的根记录器全权管理
    logging.getLogger("werkzeug").propagate = False