import React from 'react';
import { FileText, CloudUpload, Settings } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
  isConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick, isConfigured }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">履歷解析小幫手</h1>
            <p className="text-xs text-gray-500">自動化資料提取 & 雲端同步</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`hidden md:flex items-center px-3 py-1 rounded-full text-sm font-medium border ${isConfigured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            <CloudUpload className="w-4 h-4 mr-2" />
            {isConfigured ? '已連線至雲端' : '僅本機模式'}
          </div>
          <button 
            onClick={onSettingsClick}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="設定雲端上傳連結"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
};