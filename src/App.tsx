import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ResultsTable } from '@/components/ResultsTable';
import { ParsedResume, ResumeData } from '@/types';
import { extractResumeData } from '@/services/geminiService';
import { fileToBase64, downloadCSV, generateCSVContent } from '@/utils/fileHelpers';
import { Upload, Download, RefreshCw, Trash2, Info, X, Save, AlertTriangle, CheckCircle2, XCircle, Zap, Package, Code } from 'lucide-react';

const App: React.FC = () => {
  const [resumes, setResumes] = useState<ParsedResume[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempScriptUrl, setTempScriptUrl] = useState('');
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [errorType, setErrorType] = useState<'none' | 'version_old' | 'network' | 'other'>('none');

  useEffect(() => {
    const savedUrl = localStorage.getItem('gas_script_url');
    if (savedUrl) {
      setScriptUrl(savedUrl);
      setTempScriptUrl(savedUrl);
    }
  }, []);

  const saveSettings = () => {
    if (tempScriptUrl && !tempScriptUrl.includes('/exec')) {
       if (!window.confirm('警告：這個網址看起來不像正確的 Web App 網址 (通常以 /exec 結尾)。確定要儲存嗎？')) {
         return;
       }
    }
    localStorage.setItem('gas_script_url', tempScriptUrl);
    setScriptUrl(tempScriptUrl);
    setShowSettings(false);
  };

  const handleTestConnection = async () => {
    if (!tempScriptUrl) {
      setTestStatus('error');
      setTestMessage('請先輸入網址');
      setErrorType('other');
      return;
    }
    if (tempScriptUrl.includes('/edit')) {
      setTestStatus('error');
      setTestMessage('錯誤：這是「編輯器」的網址，無法接受連線。\n請點擊右上角「部署」>「管理部署作業」來取得以 /exec 結尾的網址。');
      setErrorType('other');
      return;
    }
    setTestStatus('testing');
    setTestMessage('正在連線至 Google Apps Script...');
    setErrorType('none');
    try {
      const payload = { action: 'test' };
      // Note: We use 'no-cors' for simple tests if CORS is an issue, but for GAS we usually need CORS. 
      // If 'no-cors' is used, we can't read the response. 
      // We assume the GAS script handles CORS correctly (doGet/doPost outputs JSON).
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=utf-8' });
      const response = await fetch(tempScriptUrl, { method: 'POST', body: blob });
      const result = await response.json();
      if (result.result === 'success') {
        setTestStatus('success');
        setTestMessage('連線成功！Script 設定正確。');
        setErrorType('none');
      } else {
        const errorStr = result.error || '';
        if (errorStr.includes('newBlob') || errorStr.includes('Utilities')) {
             setTestStatus('error');
             setTestMessage('偵測到舊版程式碼：請建立新版本');
             setErrorType('version_old');
        } else {
             setTestStatus('error');
             setTestMessage(`連線失敗：Script 回傳錯誤 - ${errorStr}`);
             setErrorType('other');
        }
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      setTestStatus('error');
      setTestMessage(`無法連線。請檢查：\n1. 網址是否正確 (/exec 結尾)\n2. 部署時「誰可以存取」是否設為「任何人」\n錯誤訊息: ${error.message}`);
      setErrorType('network');
    }
  };

  const uploadToScript = async (file: File, base64: string, resumeData: ResumeData, url: string): Promise<string> => {
    try {
      const payload = {
        action: 'upload',
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        fileContent: base64,
        resumeData: resumeData
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=utf-8' });
      const response = await fetch(url, { method: 'POST', body: blob });
      const result = await response.json();
      if (result.result === 'success' && result.url) {
        return result.url;
      } else {
        throw new Error(result.error || 'Script returned error');
      }
    } catch (error) {
      console.error("Upload to Script failed:", error);
      throw error;
    }
  };

  const processQueue = async (currentList: ParsedResume[], files: File[], newIds: string[]) => {
    setProcessing(true);
    const fileMap: Record<string, File> = {};
    newIds.forEach((id, index) => {
      fileMap[id] = files[index];
    });
    for (const id of newIds) {
      const file = fileMap[id];
      setResumes(prev => prev.map(r => r.id === id ? { ...r, status: 'processing' } : r));
      try {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'application/pdf'; 
        const extractedData: ResumeData = await extractResumeData(base64, mimeType);
        let finalFileLink = '';
        if (scriptUrl) {
           try {
             finalFileLink = await uploadToScript(file, base64, extractedData, scriptUrl);
           } catch (uploadErr: any) {
             console.error("Cloud upload failed, falling back to local", uploadErr);
             let errorMsg = uploadErr.message || uploadErr;
             if (errorMsg.includes('newBlob')) {
               errorMsg = "Apps Script 版本過舊，請重新部署「新版本」";
             }
             alert(`檔案「${file.name}」解析成功，但上傳雲端失敗。\n\n錯誤：${errorMsg}\n\n請檢查設定中的連線測試。`);
             finalFileLink = URL.createObjectURL(file);
           }
        } else {
           finalFileLink = URL.createObjectURL(file);
           await new Promise(resolve => setTimeout(resolve, 800));
        }
        setResumes(prev => prev.map(r => r.id === id ? { 
          ...r, 
          status: 'success', 
          data: extractedData,
          fileLink: finalFileLink 
        } : r));
      } catch (error) {
        console.error(`Error processing ${file.name}`, error);
        setResumes(prev => prev.map(r => r.id === id ? { 
          ...r, 
          status: 'error', 
          errorMsg: '解析失敗' 
        } : r));
      }
    }
    setProcessing(false);
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newResumes: ParsedResume[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      fileName: file.name,
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      fileLink: '', 
    }));
    setResumes((prev) => [...prev, ...newResumes]);
    processQueue([...resumes, ...newResumes], Array.from(files), newResumes.map(r => r.id));
  }, [resumes, scriptUrl]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleExport = () => {
    const csv = generateCSVContent(resumes);
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `履歷匯出_${date}.csv`);
  };

  const handleClear = () => {
    if(window.confirm("確定要清除所有資料嗎？")) {
      setResumes([]);
    }
  };

  const stats = {
    total: resumes.length,
    success: resumes.filter(r => r.status === 'success').length,
    pending: resumes.filter(r => r.status === 'pending' || r.status === 'processing').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header 
        onSettingsClick={() => {
          setTestStatus('idle');
          setTestMessage('');
          setErrorType('none');
          setShowSettings(true);
        }} 
        isConfigured={!!scriptUrl}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
           <div>
             <h2 className="text-2xl font-bold text-gray-900">履歷管理系統</h2>
             <p className="text-sm text-gray-500 mt-1">
               已處理 {stats.success} / {stats.total} 份履歷
             </p>
           </div>
           <div className="flex space-x-3">
             <button 
               onClick={handleClear}
               className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
             >
               <Trash2 className="w-4 h-4 mr-2 text-gray-500" />
               清除所有
             </button>
             <button 
               onClick={handleExport}
               disabled={stats.success === 0}
               className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${stats.success > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
             >
               <Download className="w-4 h-4 mr-2" />
               匯出 Excel (CSV)
             </button>
           </div>
        </div>

        {!scriptUrl && (
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100 flex items-start cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => setShowSettings(true)}>
            <Info className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">尚未設定雲端上傳連結</p>
              <p className="mt-1">
                目前的檔案連結僅為「本機預覽」。若要啟用真實上傳到 Google Drive，
                請點擊右上角的設定圖示，並貼上您的 Google Apps Script 網址。
              </p>
            </div>
          </div>
        )}

        <div 
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`mb-8 relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
        >
          <input 
            type="file" 
            multiple 
            accept=".pdf,.jpg,.jpeg,.png" 
            onChange={(e) => handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center">
            <div className={`p-4 rounded-full mb-4 ${isDragOver ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${isDragOver ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              將履歷拖放到此處
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              支援 PDF, JPG, PNG。AI 將自動判讀並建立資料表。
            </p>
          </div>
        </div>

        {processing && (
          <div className="mb-6 flex items-center p-4 bg-blue-50 rounded-lg text-blue-700 border border-blue-100 animate-pulse">
            <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
            <span className="font-medium">AI 正在判讀履歷並上傳雲端 (如果已設定)...</span>
          </div>
        )}
        <ResultsTable resumes={resumes} />
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">雲端上傳設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 text-sm text-blue-800 rounded-lg flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
              <div>
                <p className="font-bold mb-1">部署前請確認：</p>
                <ul className="list-decimal list-inside space-y-1 text-xs">
                  <li><code>FOLDER_ID</code> 與 <code>SHEET_ID</code> 已填入。</li>
                  <li>部署時「執行身分」是 <strong>我 (Me)</strong>。</li>
                  <li>部署時「誰可以存取」是 <strong>任何人 (Anyone)</strong>。</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Apps Script 網址 (Web App URL)
                </label>
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={tempScriptUrl}
                    onChange={(e) => {
                      setTempScriptUrl(e.target.value);
                      setTestStatus('idle');
                      setErrorType('none');
                    }}
                    placeholder="https://script.google.com/macros/s/..../exec"
                    className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 border p-2 text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">必須以 <code>/exec</code> 結尾。</p>
              </div>

              <div className="flex items-start justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex-1 mr-2">
                  {testStatus === 'idle' && <p className="text-sm text-gray-500">輸入網址後，請點擊測試。</p>}
                  {testStatus === 'testing' && <p className="text-sm text-blue-600 flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> 測試中...</p>}
                  {testStatus === 'success' && <p className="text-sm text-green-600 font-medium flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> {testMessage}</p>}
                  {testStatus === 'error' && errorType !== 'version_old' && <p className="text-sm text-red-600 whitespace-pre-wrap flex items-start"><XCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0"/> <span>{testMessage}</span></p>}
                  {testStatus === 'error' && errorType === 'version_old' && <p className="text-sm text-red-600 font-bold flex items-center"><XCircle className="w-4 h-4 mr-1"/>版本過舊，請看下方說明</p>}
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={!tempScriptUrl || testStatus === 'testing'}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors flex items-center flex-shrink-0"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  測試連線
                </button>
              </div>
              
              {testStatus === 'error' && errorType === 'version_old' && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="text-red-800 font-bold flex items-center mb-2 text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2"/>
                    Apps Script 版本未更新
                  </h4>
                  <div className="text-sm text-red-700 space-y-2">
                    <p>您的程式碼雖然儲存了，但 Web App 網址仍對應到「舊版」。</p>
                    
                    <details className="mt-3 bg-white p-3 rounded border border-red-100 shadow-sm">
                      <summary className="cursor-pointer font-bold text-gray-800 flex items-center">
                        <Code className="w-4 h-4 mr-1"/> 步驟 1：點此檢查程式碼範本
                      </summary>
                      <div className="mt-2 text-xs text-gray-600">
                        <p className="mb-1">請確認您的 <code>doPost(e)</code> 函數開頭包含以下這段：</p>
                        <pre className="bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
{`function doPost(e) {
  // ...
  const data = JSON.parse(e.postData.contents);

  // ★★★ 關鍵：新版必須有這段 ★★★
  if (data.action === 'test') {
    return sendJson({
      result: 'success',
      message: '連線成功！' 
    });
  }
  // ...`}
                        </pre>
                        <p className="mt-1 text-red-600">如果您沒有這段，請先貼上並儲存！</p>
                      </div>
                    </details>

                    <div className="bg-white p-3 rounded border border-red-100 shadow-sm mt-2">
                      <h5 className="font-bold text-gray-800 mb-1">步驟 2：正確部署方式</h5>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700 text-xs">
                        <li>點擊右上角 <span className="bg-gray-200 px-1 rounded">部署</span> &gt; <span className="bg-gray-200 px-1 rounded">管理部署作業</span>。</li>
                        <li>點擊 <span className="bg-gray-200 px-1 rounded">✏️ 編輯</span>。</li>
                        <li>版本選擇：<span className="bg-blue-100 text-blue-800 px-1 rounded font-bold">建立新版本</span>。</li>
                        <li>點擊 <span className="bg-blue-600 text-white px-1 rounded">部署</span>。</li>
                      </ol>
                    </div>
                    
                    <p className="text-xs mt-2 font-medium text-gray-900 bg-yellow-100 p-2 rounded border border-yellow-200">
                      ⚠️ 注意：如果您是按「新增部署 (New Deployment)」，網址會改變！請務必複製新的網址貼上。
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                 {/* Download Source Button */}
                 <div className="flex flex-col">
                  <span className="text-xs text-gray-400 mb-1">想變成永久網站？</span>
                   <button
                      onClick={async () => {
                        // Placeholder
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                      id="download-btn"
                   >
                     <Package className="w-4 h-4 mr-1" />
                     下載原始碼 (Deploy to Vercel)
                   </button>
                 </div>

                 <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button 
                      onClick={saveSettings}
                      disabled={testStatus !== 'success' && !!tempScriptUrl}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center ${
                        (testStatus !== 'success' && !!tempScriptUrl) 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      儲存設定
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
