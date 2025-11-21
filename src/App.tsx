import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ResultsTable } from '@/components/ResultsTable';
import { ParsedResume, ResumeData } from '@/types';
import { extractResumeData } from '@/services/geminiService';
import { fileToBase64, downloadCSV, generateCSVContent } from '@/utils/fileHelpers';
import { Upload, Download, RefreshCw, Trash2, Info, X, Save, AlertTriangle, CheckCircle2, XCircle, Zap, Package, Code, Copy, Settings, CloudUpload, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

const GAS_SCRIPT_CODE = `
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'test') {
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Connection established' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'upload') {
      const folderId = "ROOT"; 
      let folder;
      if (folderId === "ROOT") {
        folder = DriveApp.getRootFolder();
      } else {
        try {
          folder = DriveApp.getFolderById(folderId);
        } catch (e) {
          folder = DriveApp.getRootFolder();
        }
      }

      const blob = Utilities.newBlob(Utilities.base64Decode(data.fileContent), data.mimeType, data.filename);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileUrl = file.getUrl();

      const sheetName = "履歷收集表_AI解析";
      let ss;
      const files = DriveApp.getFilesByName(sheetName);
      if (files.hasNext()) {
        const file = files.next();
        ss = SpreadsheetApp.open(file);
      } else {
        ss = SpreadsheetApp.create(sheetName);
      }

      let sheet = ss.getSheets()[0];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "上傳時間", "姓名", "性別", "出生日期", "手機", 
          "工作經驗", "特殊身份", "最近公司", "最近職稱", "戶籍縣市", "檔案連結"
        ]);
      }

      const r = data.resumeData;
      sheet.appendRow([
        new Date(),
        r.name,
        r.gender,
        r.dob,
        r.mobile,
        r.workExperienceYears,
        r.specialIdentity,
        r.lastCompanyName,
        r.lastJobTitle,
        r.householdCity,
        fileUrl
      ]);

      return ContentService.createTextOutput(JSON.stringify({ 
        result: 'success', 
        url: fileUrl 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: f.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export const App = () => {
  const [resumes, setResumes] = useState<ParsedResume[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempScriptUrl, setTempScriptUrl] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

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
      return;
    }
    if (tempScriptUrl.includes('/edit')) {
      setTestStatus('error');
      setTestMessage('錯誤：這是「編輯器」的網址，無法接受連線。請檢查網址是否以 /exec 結尾。');
      return;
    }
    setTestStatus('testing');
    setTestMessage('正在連線至 Google Apps Script...');
    try {
      const payload = { action: 'test' };
      const response = await fetch(tempScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.result === 'success') {
        setTestStatus('success');
        setTestMessage('連線成功！Script 設定正確。');
      } else {
        const errorStr = result.error || '';
        setTestStatus('error');
        setTestMessage(`連線失敗：Script 回傳錯誤 - ${errorStr}`);
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      setTestStatus('error');
      setTestMessage(`無法連線。請檢查：1. 網址是否正確 2. 部署權限是否為「任何人」。錯誤: ${error.message}`);
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
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
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
    newIds.forEach((id, index) => { fileMap[id] = files[index]; });
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
             if (errorMsg.includes('newBlob')) errorMsg = "Apps Script 版本過舊，請重新部署「新版本」";
             console.warn(`檔案「${file.name}」解析成功，但上傳雲端失敗。${errorMsg}`);
             finalFileLink = URL.createObjectURL(file);
           }
        } else {
           finalFileLink = URL.createObjectURL(file);
           await new Promise(resolve => setTimeout(resolve, 500));
        }
        setResumes(prev => prev.map(r => r.id === id ? { ...r, status: 'success', data: extractedData, fileLink: finalFileLink } : r));
      } catch (error) {
        console.error(`Error processing ${file.name}`, error);
        setResumes(prev => prev.map(r => r.id === id ? { ...r, status: 'error', errorMsg: '解析失敗' } : r));
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
    if(window.confirm("確定要清除所有資料嗎？")) setResumes([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
       {/* UI Render Logic ... */}
    </div>
  );
};
