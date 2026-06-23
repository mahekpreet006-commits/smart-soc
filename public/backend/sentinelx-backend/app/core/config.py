from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://sentinelx:sentinelx@localhost:5432/sentinelx"
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60

    AGENT_API_KEY: str = "dev-agent-key"
    SIMULATOR_ENABLED: bool = True
    SIMULATOR_INTERVAL_SECONDS: int = 8

    CORS_ORIGINS: str = "*"
    DB_POOL_SIZE: int = 10

    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@sentinelx.local"
    ADMIN_PASSWORD: str = "ChangeMe!123"

    @property
    def cors_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
