import time
import random
import threading
import math
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
import ctypes

try:
    import keyboard
    import pyautogui
except ImportError:
    print("【严重错误】缺少 Python 的底层驱动扩展运行库！")
    print("请先打开终端/命令行 (cmd/powershell)，并粘贴执行以下命令：")
    print("pip install keyboard pyautogui")
    input("按回车键退出...")
    sys.exit(1)

# 安全配置：无视角落防误触断电（由于我们自己指定随机范围，所以允许边际活动）
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

# --- 核心数据 ---
target_x = 0
target_y = 0
target_saved = False
PORT = 28282

# --- 硬件与操作系统 API 层 (Ctypes wrapper) ---
user32 = ctypes.windll.user32

class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

# Windows 基本数值常量
HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
LWA_ALPHA = 0x00000002

WM_MOUSEMOVE = 0x0200
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_APPCOMMAND = 0x0319
APPCOMMAND_BROWSER_BACKWARD = 1

def SetLayeredWindowAttributes(hwnd, crKey, bAlpha, dwFlags):
    user32.SetLayeredWindowAttributes.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_byte, ctypes.c_int]
    user32.SetLayeredWindowAttributes(hwnd, crKey, bAlpha, dwFlags)

window_alpha = {}  # 缓存各个窗口透明度字典
topmost_state = {}
target_hwnd = None
target_top_hwnd = None
target_rel_x = 0
target_rel_y = 0

def apply_transparency(hwnd, alpha):
    ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    if not (ex_style & WS_EX_LAYERED):
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED)
    SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)

# --- 核心：高级拟真后台点击 (Background PostMessage) ---
def background_click(target_h, rel_x, rel_y):
    # 将相对坐标转换为 lParam
    lparam = (int(rel_y) << 16) | (int(rel_x) & 0xFFFF)
    
    # 后台模拟：移动鼠标到位置（不抢夺物理鼠标）
    user32.PostMessageW(target_h, WM_MOUSEMOVE, 0, lparam)
    time.sleep(random.uniform(0.015, 0.045))
    
    # 后台模拟：左键按下
    user32.PostMessageW(target_h, WM_LBUTTONDOWN, 1, lparam)
    time.sleep(random.uniform(0.02, 0.08))
    
    # 后台模拟：左键抬起
    user32.PostMessageW(target_h, WM_LBUTTONUP, 0, lparam)

def get_top_window(hwnd):
    parent = user32.GetParent(hwnd)
    while parent:
        hwnd = parent
        parent = user32.GetParent(hwnd)
    return hwnd

# --- 无头隐蔽内网节点服务 (Private HTTP Broker) ---
class GameMacroServer(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass 
        
    def do_GET(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-type", "application/json")
        self.end_headers()
        
        if self.path == "/click":
            if target_saved and target_hwnd:
                # 随机正态分布漂移
                x = target_rel_x + random.gauss(0, 30) 
                y = target_rel_y + random.gauss(0, 30)
                x = max(target_rel_x - 100, min(target_rel_x + 100, x))
                y = max(target_rel_y - 100, min(target_rel_y + 100, y))
                
                print(f"[-] 执行安全后台点击 -> 目标窗口:{target_hwnd} 落点: X:{int(x)}, Y:{int(y)}")
                background_click(target_hwnd, int(x), int(y))
            else:
                print("[警告] 未锁定窗口坐标，请按 Ctrl+Alt+M")
                
        elif self.path == "/back":
            if target_saved and target_top_hwnd:
                print("[-] API指令收到：通过后台消息发送硬件后退 (Browser_Back)")
                user32.PostMessageW(target_top_hwnd, WM_APPCOMMAND, target_top_hwnd, APPCOMMAND_BROWSER_BACKWARD << 16)
            else:
                print("[警告] 未捕捉到目标顶层窗口，无法后台后退！请按 Ctrl+Alt+M 重新绑定游戏区。")

        elif self.path == "/ping":
            print(f"[#] 前端 JS 已建立并确认桥接通讯稳定...")
            
        self.wfile.write(b'{"status":"ok"}')

def run_server():
    server = HTTPServer(('127.0.0.1', PORT), GameMacroServer)
    server.serve_forever()

# --- 拓展：快捷键黑客操控法术回调 ---
def save_mouse_pos():
    global target_x, target_y, target_saved, target_hwnd, target_top_hwnd, target_rel_x, target_rel_y
    target_x, target_y = pyautogui.position()
    
    # 捕捉当前鼠标正下方的精确窗口句柄（用于点击）
    pt = POINT(target_x, target_y)
    hwnd = user32.WindowFromPoint(pt)
    target_hwnd = hwnd
    
    # 捕捉顶层父窗口句柄（用于发送 Browser_Back）
    target_top_hwnd = get_top_window(hwnd)
    
    # 将屏幕绝对坐标转换为窗口相对坐标（保证窗口即使移动了，后台点击也很准确）
    user32.ScreenToClient(hwnd, ctypes.byref(pt))
    target_rel_x = pt.x
    target_rel_y = pt.y
    
    target_saved = True
    print(f"🎯 [后台锁定] 目标句柄: {target_hwnd} | 相对坐标: (X={target_rel_x}, Y={target_rel_y}) \n你可以去其他屏幕工作了，脚本将在纯后台独立运行！")

def toggle_topmost():
    hwnd = user32.GetForegroundWindow()
    current_state = topmost_state.get(hwnd, False)
    new_state = not current_state
    
    if new_state:
        user32.SetWindowPos(hwnd, HWND_TOPMOST, 0,0,0,0, SWP_NOMOVE | SWP_NOSIZE)
        print("📌 | 当前焦点窗口 -> 【暴力置顶】启用")
    else:
        user32.SetWindowPos(hwnd, HWND_NOTOPMOST, 0,0,0,0, SWP_NOMOVE | SWP_NOSIZE)
        print("🔽 | 当前焦点窗口 -> 脱离置顶层")
        
    topmost_state[hwnd] = new_state

def change_opacity(delta):
    hwnd = user32.GetForegroundWindow()
    alpha = window_alpha.get(hwnd, 255)
    alpha = max(20, min(255, alpha + delta)) # 最透明不低于20免得窗消亡
    
    if alpha >= 255:
        # 当加回255时，将窗口去透明层包装提高游戏底层渲染帧速
        alpha = 255
        ex_style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style & ~WS_EX_LAYERED)
        print("🪟 | 目标窗口 -> 恢复绝对实体透明度 [100%]")
    else:
        apply_transparency(hwnd, alpha)
        percent = int((alpha / 255) * 100)
        print(f"🌫️ | 目标窗口 -> 调整透明能见度: [{percent}%]")
        
    window_alpha[hwnd] = alpha


if __name__ == "__main__":
    # --- 界面装饰与系统装载 ---
    ctypes.windll.kernel32.SetConsoleTitleW("GBF Python Security Protocol Bridge")
    print("=" * 60)
    print(" 🚀 GBF 究极防检测：纯 Python 降维挂机宏")
    print("=" * 60)
    print(" [硬件虚拟映射与透明控制面板组件 | 已点亮]")
    print("   👉 瞄准指令: Ctrl + Alt + M (准星对准网页空地录入)")
    print("   👉 置顶指令: Ctrl + Alt + ↑ (锁定在最上方播放器模式)")
    print("   👉 幽灵隐去: Ctrl + Alt + ← (当前游戏变透明)")
    print("   👉 肉眼显现: Ctrl + Alt + → (当前游戏加清晰)")
    print("=" * 60)
    print(f" [*] 无头中继服务监听中 -> HTTP 端口: {PORT} ...")
    print("-" * 60)
    
    # 挂接所有系统级别的底层键盘热键侦听
    keyboard.add_hotkey('ctrl+alt+m', save_mouse_pos)
    keyboard.add_hotkey('ctrl+alt+up', toggle_topmost)
    keyboard.add_hotkey('ctrl+alt+left', lambda: change_opacity(-125)) 
    keyboard.add_hotkey('ctrl+alt+right', lambda: change_opacity(125))

    # 开辟子维度宇宙线程支撑起单项内网接收服务阻塞池
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # 阻塞主线程以持续进行键盘生命线维持 (永不过期)
    keyboard.wait()
