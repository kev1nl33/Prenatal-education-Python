import sys
import os
from flask import Flask, jsonify, Blueprint
import subprocess

# ... (Flask app definition - same as before)

# ... (File writing - same as before)

# 安装 pyngrok
subprocess.run(['pip', 'install', 'pyngrok'])

# 认证 ngrok 和启动服务器，根据环境进行调整
try:
    # Colab 环境
    from google.colab import output
    output.eval_js('new Audio("https://upload.wikimedia.org/wikipedia/commons/0/05/Beep-09.ogg").play()')
    get_ipython().system_raw("ngrok authtoken YOUR_AUTHTOKEN &") # 替换为你的ngrok authtoken
    from pyngrok import ngrok
    public_url = ngrok.connect(5000).public_url
    print(f"Server started. Please visit the following URL: {public_url}")
    subprocess.Popen([sys.executable, "server.py"])

    # 保持 Colab 连接
    while True:
        pass

except ModuleNotFoundError:
    # 本地环境
    subprocess.run(["ngrok", "authtoken", "YOUR_AUTHTOKEN"]) # 替换为你的ngrok authtoken
    subprocess.run([sys.executable, "server.py"]) # 直接运行，不使用后台进程


