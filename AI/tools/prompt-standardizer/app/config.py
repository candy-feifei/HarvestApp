from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PROMPT_STD_")

    data_dir: Path = Path("/data")
    database_url: str | None = None

    # NoSQL (AI chat logs, project KB, strategy history)
    mongo_uri: str = ""
    mongo_db: str = "prompt_std"

    # OpenAI-compatible LLM endpoints (set keys for providers you use)
    deepseek_api_key: str | None = None
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com/v1"

    qwen_api_key: str | None = None
    qwen_model: str = "qwen-turbo"
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # Tencent Yuanbao / other proxies: set base to vendor OpenAI-compatible root
    yuanbao_api_key: str | None = None
    yuanbao_model: str = "hunyuan-turbo"
    yuanbao_base_url: str = ""

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "prompt_std.db"

    @property
    def effective_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.sqlite_path.as_posix()}"


settings = Settings()
