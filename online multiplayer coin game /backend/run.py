import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0",  # 监听所有网络接口
        port=8000, 
        reload=True
    ) 