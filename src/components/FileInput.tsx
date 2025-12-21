import React, { useRef } from 'react';

interface FileInputProps {
  onFileLoad: (content: string) => void;
}

export const FileInput: React.FC<FileInputProps> = ({ onFileLoad }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        onFileLoad(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="file-input-wrapper">
      <div className="file-input">
        <label htmlFor="csvFile">Load Data</label>
        <input
          ref={inputRef}
          type="file"
          id="csvFile"
          accept=".csv"
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
