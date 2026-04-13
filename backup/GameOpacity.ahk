; ==========================================
; 适用版本：AutoHotkey v2.0+
; 快捷键说明：
; Ctrl (^) + Shift (+) + Up/Left/Right
; "A" 代表当前激活的窗口 (Active Window)
; ==========================================

; 1. 按 Ctrl + Shift + 上方向键：切换置顶状态
^+Up::
{
    ; -1 代表切换 (Toggle) 状态
    WinSetAlwaysOnTop -1, "A"
}

; 2. 按 Ctrl + Shift + 左方向键：增加透明度 49% (画面变得更透明)
^+Left::
{
    ; 获取当前透明度
    currentAlpha := WinGetTransparent("A")
    
    ; v2 中如果未设置透明度，会返回空字符串
    if (currentAlpha = "") {
        currentAlpha := 255
    }
    
    newAlpha := currentAlpha - 125
    
    ; 安全限制：防止窗口完全消失
    if (newAlpha < 30) {
        newAlpha := 30
    }
    
    WinSetTransparent newAlpha, "A"
}

; 3. 按 Ctrl + Shift + 右方向键：减少透明度 49% (画面变得更清晰)
^+Right::
{
    currentAlpha := WinGetTransparent("A")
    
    if (currentAlpha = "") {
        currentAlpha := 255
    }
    
    newAlpha := currentAlpha + 125
    
    ; 恢复到不透明状态时，直接关闭透明度属性
    if (newAlpha >= 255) {
        WinSetTransparent "Off", "A"
    } else {
        WinSetTransparent newAlpha, "A"
    }
}