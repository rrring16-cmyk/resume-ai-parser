import React from 'react';
import { ParsedResume } from '../types';
import { CheckCircle, AlertCircle, Loader2, File as FileIcon } from 'lucide-react';

interface ResultsTableProps {
  resumes: ParsedResume[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ resumes }) => {
  if (resumes.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-500">尚未上傳任何履歷，請拖放檔案開始處理。</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">狀態</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上傳日期</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出生日期</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手機1</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工作經驗</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">特殊身份</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">公司名稱</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">職務名稱</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">戶籍縣市</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">檔案連結</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {resumes.map((resume) => (
              <tr key={resume.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap">
                  {resume.status === 'pending' && <div className="w-2 h-2 bg-gray-300 rounded-full"></div>}
                  {resume.status === 'processing' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                  {resume.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {resume.status === 'error' && (
                    <div title={resume.errorMsg} className="inline-flex cursor-help">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.uploadDate}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{resume.data?.name || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.data?.gender || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.data?.dob || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.data?.mobile || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[150px] truncate" title={resume.data?.workExperienceYears}>{resume.data?.workExperienceYears || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.data?.specialIdentity || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[150px] truncate" title={resume.data?.lastCompanyName}>{resume.data?.lastCompanyName || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[150px] truncate" title={resume.data?.lastJobTitle}>{resume.data?.lastJobTitle || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{resume.data?.householdCity || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600">
                  {resume.fileLink ? (
                     <a href={resume.fileLink} target="_blank" rel="noreferrer" className="flex items-center hover:underline" title="檢視檔案">
                       <FileIcon className="w-4 h-4 mr-1" />
                       開啟
                     </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};