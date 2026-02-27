"""
LLM Provider Factory

Supports multiple LLM providers through LangChain:
- OpenAI (GPT-4o, GPT-4, GPT-3.5-turbo)
- Google Gemini (gemini-2.5-flash)
- Ollama (local models like qwen2.5, llama3, mistral)

Usage:
    from llm import get_llm
    
    # Use default provider from LLM_PROVIDER env var
    llm = get_llm()
    
    # Or specify provider explicitly
    llm = get_llm(provider="openai")
"""

import os
from enum import Enum
from typing import Optional
from dataclasses import dataclass

from langchain_core.language_models.chat_models import BaseChatModel


class LLMProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    OLLAMA = "ollama"


@dataclass
class ProviderConfig:
    """Configuration for an LLM provider"""
    provider: LLMProvider
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None


def get_provider_config(provider: Optional[str] = None) -> ProviderConfig:
    """
    Get configuration for the specified provider.
    Falls back to LLM_PROVIDER env var if not specified.
    """
    provider_name = provider or os.getenv("LLM_PROVIDER", "ollama")
    provider_enum = LLMProvider(provider_name.lower())
    
    match provider_enum:
        case LLMProvider.OPENAI:
            return ProviderConfig(
                provider=provider_enum,
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                api_key=os.getenv("OPENAI_API_KEY"),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.7")),
                max_tokens=int(os.getenv("OPENAI_MAX_TOKENS")) if os.getenv("OPENAI_MAX_TOKENS") else None,
            )
        
        case LLMProvider.GEMINI:
            return ProviderConfig(
                provider=provider_enum,
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                api_key=os.getenv("GOOGLE_API_KEY"),
                temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.7")),
                max_tokens=int(os.getenv("GEMINI_MAX_TOKENS")) if os.getenv("GEMINI_MAX_TOKENS") else None,
            )
        
        case LLMProvider.OLLAMA:
            return ProviderConfig(
                provider=provider_enum,
                model=os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct"),
                base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"),
                temperature=float(os.getenv("OLLAMA_TEMPERATURE", "0.7")),
            )
        
        case _:
            raise ValueError(f"Unknown provider: {provider_name}")


def get_llm(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    **kwargs
) -> BaseChatModel:
    """
    Get a LangChain chat model for the specified provider.
    
    Args:
        provider: Provider name ("openai", "gemini", "ollama"). 
                  Defaults to LLM_PROVIDER env var or "ollama".
        model: Override the default model for the provider.
        temperature: Override the default temperature.
        **kwargs: Additional arguments passed to the chat model.
    
    Returns:
        A LangChain BaseChatModel instance.
    
    Examples:
        # Use default provider
        llm = get_llm()
        
        # Use specific provider
        llm = get_llm(provider="openai")
        
        # Override model
        llm = get_llm(provider="openai", model="gpt-4-turbo")
    """
    config = get_provider_config(provider)
    
    # Allow overrides
    if model:
        config.model = model
    if temperature is not None:
        config.temperature = temperature
    
    match config.provider:
        case LLMProvider.OPENAI:
            from langchain_openai import ChatOpenAI
            
            if not config.api_key:
                raise ValueError("OPENAI_API_KEY environment variable is required for OpenAI provider")
            
            return ChatOpenAI(
                model=config.model,
                api_key=config.api_key,
                temperature=config.temperature,
                max_tokens=config.max_tokens,
                **kwargs
            )
        
        case LLMProvider.GEMINI:
            from langchain_google_genai import ChatGoogleGenerativeAI
            
            if not config.api_key:
                raise ValueError("GOOGLE_API_KEY environment variable is required for Gemini provider")
            
            return ChatGoogleGenerativeAI(
                model=config.model,
                google_api_key=config.api_key,
                temperature=config.temperature,
                max_output_tokens=config.max_tokens,
                **kwargs
            )
        
        case LLMProvider.OLLAMA:
            from langchain_ollama import ChatOllama
            
            return ChatOllama(
                model=config.model,
                base_url=config.base_url,
                temperature=config.temperature,
                **kwargs
            )
        
        case _:
            raise ValueError(f"Unknown provider: {config.provider}")


def get_llm_with_fallback(
    primary_provider: Optional[str] = None,
    fallback_provider: str = "ollama",
    **kwargs
) -> BaseChatModel:
    """
    Get an LLM with automatic fallback if the primary fails.
    
    Useful for production where you want to fall back to a local
    model if the cloud API is unavailable.
    """
    from langchain_core.runnables import RunnableWithFallbacks
    
    primary = get_llm(provider=primary_provider, **kwargs)
    fallback = get_llm(provider=fallback_provider, **kwargs)
    
    return primary.with_fallbacks([fallback])


async def check_provider_health(provider: Optional[str] = None) -> dict:
    """
    Check if an LLM provider is available and responding.
    
    Returns:
        dict with "healthy" bool and "message" string
    """
    try:
        llm = get_llm(provider=provider)
        # Simple test message
        response = await llm.ainvoke("Say 'ok' and nothing else.")
        return {
            "healthy": True,
            "provider": provider or os.getenv("LLM_PROVIDER", "ollama"),
            "message": "Provider is responding",
            "test_response": response.content[:50] if response.content else None
        }
    except Exception as e:
        return {
            "healthy": False,
            "provider": provider or os.getenv("LLM_PROVIDER", "ollama"),
            "message": str(e),
        }
