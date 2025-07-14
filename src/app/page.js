"use client";

import React, { useState, useEffect, useRef } from "react";
import { wordList } from "./constanct";
import { wordStatsManager } from "./wordStats";

// Helper function to shuffle arrays
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Card Component
const WordCard = ({
  word,
  lang,
  onClick,
  isSelected,
  isCorrect,
  isIncorrect,
}) => {
  const getCardClass = () => {
    let baseClass =
      "card border-2 bg-white rounded-xl p-3 sm:p-4 text-center cursor-pointer text-base sm:text-lg font-medium text-slate-700 transition-all duration-150 ease-out relative hover:shadow-md active:scale-95";
    if (isCorrect)
      return `${baseClass} border-emerald-400 bg-green-50 text-green-800 opacity-80 cursor-not-allowed hover:shadow-none`;
    if (isIncorrect)
      return `${baseClass} border-red-400 bg-red-50 animate-shake`;
    if (isSelected)
      return `${baseClass} border-blue-500 bg-blue-50 transform -translate-y-1 scale-105 shadow-lg`;
    return `${baseClass} border-slate-200 hover:border-blue-400 hover:-translate-y-0.5`;
  };

  // ดึงข้อมูลสถิติเพื่อแสดง difficulty indicator
  const stats = wordStatsManager.getWordStat(word);
  const weight = stats.weight;
  
  const getDifficultyIndicator = () => {
    if (stats.totalSeen === 0) return null;
    
    // แสดงไอคอนตามสถานะต่างๆ
    if (stats.markedDifficult && stats.markedDifficult > 0) {
      return <div className="absolute top-1 right-1 text-orange-500 text-xs" title={`Mark ยาก ${stats.markedDifficult} ครั้ง`}>🔖</div>;
    } else if (weight > 1.5) {
      return <div className="absolute top-1 right-1 text-red-500 text-xs" title="คำยาก">🔥</div>;
    } else if (weight < 0.3) {
      return <div className="absolute top-1 right-1 text-green-500 text-xs" title="คำง่าย">✨</div>;
    }
    return null;
  };

  return (
    <div className={getCardClass()} onClick={() => onClick({ word, lang })}>
      {word}
      {getDifficultyIndicator()}
    </div>
  );
};

// Main Game Component
const WordMatchGame = () => {
  // State variables
  const [currentWords, setCurrentWords] = useState([]);
  const [englishWords, setEnglishWords] = useState([]);
  const [thaiWords, setThaiWords] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [correctPairs, setCorrectPairs] = useState([]);
  const [incorrectPair, setIncorrectPair] = useState(null);
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showMarkedWords, setShowMarkedWords] = useState(false);
  const [statsUpdateKey, setStatsUpdateKey] = useState(0);
  const [gameMode, setGameMode] = useState('normal'); // 'normal' | 'marked'

  // Refs for audio synthesizers
  const synths = useRef(null);

  // Effect to run on client-side only
  useEffect(() => {
    setIsClient(true);
    // Dynamically import Tone.js only on the client
    import("tone").then((Tone) => {
      synths.current = {
        select: new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.1 },
          volume: -18,
        }).toDestination(),
        correct: new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3 },
          volume: -12,
        }).toDestination(),
        incorrect: new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
          volume: -14,
        }).toDestination(),
      };
    });
  }, []);

  // Function to initialize or restart the game
  const initGame = () => {
    setIsChecking(true);
    setMessage("");
    setCorrectPairs([]);
    setSelectedCard(null);
    setIncorrectPair(null);

    // เลือกคำตามโหมดเกม
    let newWordPairs;
    if (gameMode === 'marked') {
      newWordPairs = wordStatsManager.markedWordsRandomSelection(4);
      // ถ้าไม่มีคำ mark เพียงพอ ให้กลับไปโหมดปกติ
      if (newWordPairs.length < 4) {
        setGameMode('normal');
        setMessage("⚠️ คำที่ mark ไม่เพียงพอ กลับสู่โหมดปกติ");
        newWordPairs = wordStatsManager.weightedRandomSelection(wordList, 4);
      }
    } else {
      // โหมดปกติ: ใช้ weighted random selection แทนการสุ่มปกติ
      newWordPairs = wordStatsManager.weightedRandomSelection(wordList, 4);
    }
    
    setCurrentWords(newWordPairs);
    setEnglishWords(shuffleArray(newWordPairs.map((p) => p.en)));
    setThaiWords(shuffleArray(newWordPairs.map((p) => p.th)));

    // ลดเวลาหน่วงลงเหลือ 200ms
    setTimeout(() => setIsChecking(false), 200);
  };

  // Initialize game on component mount
  useEffect(() => {
    initGame();
  }, [gameMode]); // เพิ่ม gameMode เป็น dependency

  // Function to speak a word
  const speakWord = (word) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Card click handler
  const handleCardClick = async (card) => {
    // ตรวจสอบเฉพาะคำที่จับคู่แล้วและป้องกันการกดซ้ำขณะตรวจสอบ
    const isCardMatched = correctPairs.includes(card.word) || 
      correctPairs.includes(currentWords.find((p) => p.th === card.word)?.en);
    
    if (isCardMatched) return;
    
    // อนุญาตให้เลือกการ์ดใหม่ได้แม้ขณะ isChecking (สำหรับการเปลี่ยนการเลือก)
    // แต่ไม่ให้ทำการจับคู่ใหม่ขณะกำลัง check
    if (isChecking && selectedCard) return;

    // Start audio context on first click
    if (isClient && window.Tone && window.Tone.context.state !== "running") {
      await window.Tone.start();
    }

    if (card.lang === "en") {
      speakWord(card.word);
    }

    if (!selectedCard) {
      setSelectedCard(card);
      synths.current?.select.triggerAttackRelease("G5", "32n");
    } else {
      // อนุญาตให้เปลี่ยนการเลือกการ์ดภาษาเดียวกันได้เสมอ
      if (selectedCard.lang === card.lang) {
        setSelectedCard(card);
        synths.current?.select.triggerAttackRelease("G5", "32n");
        return;
      }

      // ป้องกันการจับคู่ใหม่ขณะกำลัง check อยู่
      if (isChecking) return;

      setIsChecking(true);

      const [first, second] =
        selectedCard.lang === "en"
          ? [selectedCard, card]
          : [card, selectedCard];
      const isMatch = currentWords.some(
        (p) => p.en === first.word && p.th === second.word
      );

      if (isMatch) {
        // บันทึกว่าตอบถูก
        wordStatsManager.recordAnswer(first.word, true);
        wordStatsManager.recordAnswer(second.word, true);
        
        setCorrectPairs((prev) => [...prev, first.word, second.word]);
        setMessage("ถูกต้อง!");
        synths.current?.correct.triggerAttackRelease(["C5", "G5"], "16n");
        setSelectedCard(null);
        if (correctPairs.length + 2 === 8) {
          setTimeout(initGame, 1200);
          setMessage("ยอดเยี่ยม! เริ่มรอบใหม่...");
        } else {
          setTimeout(() => {
            setMessage("");
            setIsChecking(false);
          }, 500);
        }
      } else {
        // บันทึกว่าตอบผิด
        wordStatsManager.recordAnswer(selectedCard.word, false);
        wordStatsManager.recordAnswer(card.word, false);
        
        setIncorrectPair({ word1: selectedCard.word, word2: card.word });
        setMessage("พยายามอีกครั้ง!");
        synths.current?.incorrect.triggerAttackRelease("A2", "16n");
        setTimeout(() => {
          setIncorrectPair(null);
          setSelectedCard(null);
          setMessage("");
          setIsChecking(false);
        }, 600);
      }
    }
  };

  if (!isClient) {
    return null; // Render nothing on the server
  }

  // Stats Component
  const StatsModal = () => {
    const [statsData, setStatsData] = useState(null);
    const [wordListInfo, setWordListInfo] = useState(null);
    
    // Load stats data when modal opens or when statsUpdateKey changes
    useEffect(() => {
      if (showStats) {
        const stats = wordStatsManager.getSummaryStats();
        const wordInfo = wordStatsManager.getWordListInfo();
        setStatsData(stats);
        setWordListInfo(wordInfo);
      }
    }, [showStats, statsUpdateKey]);
    
    if (!showStats || !statsData || !wordListInfo) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">📊 สถิติการเล่น</h2>
            <button
              onClick={() => setShowStats(false)}
              className="text-slate-500 hover:text-slate-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            {/* สถิติรวม */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3">📈 ภาพรวม</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-600">คำทั้งหมดในเกม</div>
                  <div className="text-xl font-bold text-blue-600">{statsData.totalWordsInDatabase}</div>
                  <div className="text-xs text-slate-400">อัปเดตอัตโนมัติ</div>
                </div>
                <div>
                  <div className="text-slate-600">คำอังกฤษที่เล่นแล้ว</div>
                  <div className="text-xl font-bold text-green-600">{statsData.wordsPlayedCount}</div>
                  <div className="text-xs text-slate-400">
                    {statsData.totalWordsInDatabase > 0 ? 
                      `${Math.round((statsData.wordsPlayedCount / statsData.totalWordsInDatabase) * 100)}% ของทั้งหมด` : 
                      '0%'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">ตอบคำอังกฤษทั้งหมด</div>
                  <div className="text-lg font-bold text-slate-700">{statsData.totalAttempts} ครั้ง</div>
                </div>
                <div>
                  <div className="text-slate-600">ความแม่นยำรวม</div>
                  <div className="text-lg font-bold text-emerald-600">{statsData.overallAccuracy}%</div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span>ความคืบหน้าการเรียนรู้ (คำอังกฤษ)</span>
                <span>{Math.round((statsData.wordsPlayedCount / statsData.totalWordsInDatabase) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(statsData.wordsPlayedCount / statsData.totalWordsInDatabase) * 100}%` }}
                />
              </div>
            </div>
            
            {/* คำภาษาอังกฤษที่ตอบผิดบ่อยที่สุด */}
            {statsData.mostIncorrect.length > 0 ? (
              <div>
                <h3 className="font-semibold text-red-600 mb-3">🔥 คำอังกฤษที่ตอบผิดบ่อยที่สุด</h3>
                <div className="space-y-2">
                  {statsData.mostIncorrect.slice(0, 5).map((item, index) => (
                    <div key={index} className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium text-slate-800">{item.word}</span>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-red-600 font-semibold">ผิด {item.incorrectCount} ครั้ง</div>
                          <div className="text-slate-500">แม่นยำ {item.accuracy}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : statsData.wordsPlayedCount > 0 && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                <div className="text-green-600 font-medium">🎉 ยังไม่มีคำภาษาอังกฤษที่ตอบผิด</div>
                <div className="text-green-500 text-sm">เล่นต่อไปเพื่อสะสมข้อมูล</div>
              </div>
            )}
            
            {/* คำภาษาอังกฤษที่ความแม่นยำต่ำ */}
            {statsData.leastAccurate.length > 0 && (
              <div>
                <h3 className="font-semibold text-orange-600 mb-3">⚠️ คำอังกฤษที่ความแม่นยำต่ำ</h3>
                <div className="space-y-2">
                  {statsData.leastAccurate.slice(0, 5).map((item, index) => (
                    <div key={index} className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-800">{item.word}</span>
                        <div className="text-right text-sm">
                          <div className="text-orange-600 font-semibold">{item.accuracy}%</div>
                          <div className="text-slate-500">{item.attempts} ครั้ง</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* คำภาษาอังกฤษที่ต้องฝึกฝนเพิ่ม */}
            {statsData.needMorePractice.length > 0 && (
              <div>
                <h3 className="font-semibold text-purple-600 mb-3">💪 คำอังกฤษที่ควรฝึกฝนเพิ่ม</h3>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-700 mb-2">
                    คำเหล่านี้มีความแม่นยำต่ำกว่า 70% - ระบบจะให้เจอบ่อยขึ้น
                  </div>
                  <div className="space-y-1">
                    {statsData.needMorePractice.slice(0, 8).map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="font-medium text-slate-800">{item.word}</span>
                        <span className="text-purple-600">{item.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* คำภาษาอังกฤษที่ถูก Mark ว่ายาก */}
            {statsData.markedDifficult && statsData.markedDifficult.length > 0 && (
              <div>
                <h3 className="font-semibold text-orange-600 mb-3">🔖 คำอังกฤษที่ถูก Mark ว่ายาก</h3>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="text-sm text-orange-700 mb-2">
                    คำเหล่านี้ถูกคุณทำเครื่องหมายว่ายาก - ระบบจะให้เจอบ่อยขึ้น
                  </div>
                  <div className="space-y-2">
                    {statsData.markedDifficult.slice(0, 8).map((item, index) => (
                      <div key={index} className="bg-white p-2 rounded border border-orange-200">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-500">🔖</span>
                            <span className="font-medium text-slate-800">{item.word}</span>
                          </div>
                          <div className="text-right text-xs">
                            <div className="text-orange-600 font-semibold">Mark {item.markedCount} ครั้ง</div>
                            <div className="text-slate-500">น้ำหนัก {item.weight}</div>
                          </div>
                        </div>
                        {item.lastMarked && (
                          <div className="text-xs text-slate-400 mt-1">
                            Mark ล่าสุด: {item.lastMarked}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {statsData.markedDifficult && statsData.markedDifficult.length > 8 && (
                    <div className="text-center mt-3 pt-2 border-t border-orange-200">
                      <div className="text-xs text-orange-600">
                        แสดง 8 จาก {statsData.markedDifficult.length} คำ
                      </div>
                    </div>
                  )}
                  <div className="text-center mt-3 pt-2 border-t border-orange-200">
                    <button
                      onClick={() => {
                        setShowStats(false);
                        setShowMarkedWords(true);
                      }}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                    >
                      📋 ดูรายละเอียดทั้งหมด
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* ปุ่มควบคุม */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  if (confirm('คุณต้องการรีเซ็ตสถิติทั้งหมดหรือไม่?')) {
                    wordStatsManager.resetStats();
                    setShowStats(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                🗑️ รีเซ็ตสถิติ
              </button>
              <button
                onClick={() => setShowStats(false)}
                className="flex-1 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                ปิด
              </button>
            </div>
            
            {/* Debug Info */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border text-xs text-slate-500">
              <div className="font-medium text-slate-600 mb-1">ข้อมูลระบบ</div>
              <div>📚 WordList: {wordListInfo.totalWords} คำ (อัปเดตอัตโนมัติ)</div>
              <div>🔄 ตรวจสอบล่าสุด: {wordListInfo.lastUpdated}</div>
              <div>📝 ตัวอย่างคำ: {wordListInfo.sampleWords.join(', ')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Marked Words Modal Component
  const MarkedWordsModal = () => {
    const [markedWords, setMarkedWords] = useState([]);
    
    // Load marked words when modal opens or when stats update
    useEffect(() => {
      if (showMarkedWords) {
        const words = wordStatsManager.getMarkedWordsWithTranslations();
        setMarkedWords(words);
      }
    }, [showMarkedWords, statsUpdateKey]);
    
    if (!showMarkedWords) return null;
    
    const handleRemoveMark = (englishWord) => {
      const success = wordStatsManager.removeMarkAsDifficult(englishWord);
      if (success) {
        setMessage(`🗑️ ยกเลิก mark "${englishWord}" แล้ว`);
        setTimeout(() => setMessage(""), 2000);
        // Force update stats modal
        setStatsUpdateKey(prev => prev + 1);
      }
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
          {/* Header - Fixed at top */}
          <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-slate-800">🔖 คำที่ Mark ว่ายาก</h2>
            <button
              onClick={() => setShowMarkedWords(false)}
              className="text-slate-500 hover:text-slate-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {markedWords.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">🔖</div>
                <p className="text-slate-600">ยังไม่มีคำที่ถูก mark ว่ายาก</p>
                <p className="text-slate-400 text-sm mt-2">เลือกคำอังกฤษแล้วกดปุ่ม "🔖 Mark ยาก"</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-slate-600 mb-4">
                  รายการคำที่คุณทำเครื่องหมายว่ายาก ({markedWords.length} คำ)
                </div>
                
                {/* Grid layout for better space utilization */}
                <div className="grid gap-3">
                  {markedWords.map((item, index) => (
                    <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-orange-500">🔖</span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 truncate">
                                {item.english}
                              </div>
                              <div className="text-slate-600 text-sm truncate">
                                {item.thai}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <div>Mark: {item.markedCount}x</div>
                            <div>น้ำหนัก: {item.weight}</div>
                            <div>แม่นยำ: {item.accuracy}%</div>
                            <div>เล่น: {item.attempts}x</div>
                          </div>
                          
                          {item.lastMarked && (
                            <div className="text-xs text-slate-400 mt-1 truncate">
                              {item.lastMarked}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleRemoveMark(item.english)}
                          className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors flex-shrink-0"
                          title={`ยกเลิก mark "${item.english}"`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Footer - Fixed at bottom */}
          <div className="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (confirm(`คุณต้องการยกเลิก mark ทั้งหมด ${markedWords.length} คำหรือไม่?`)) {
                    markedWords.forEach(item => {
                      wordStatsManager.removeMarkAsDifficult(item.english);
                    });
                    setMessage("🗑️ ยกเลิก mark ทั้งหมดแล้ว");
                    setTimeout(() => setMessage(""), 2000);
                    // Force update stats modal
                    setStatsUpdateKey(prev => prev + 1);
                    setShowMarkedWords(false);
                  }
                }}
                disabled={markedWords.length === 0}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                🗑️ ยกเลิกทั้งหมด
              </button>
              <button
                onClick={() => setShowMarkedWords(false)}
                className="flex-1 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.5s;
                }
                body {
                    font-family: 'IBM Plex Sans Thai', 'Inter', sans-serif;
                    -webkit-tap-highlight-color: transparent;
                    background-color: #f8fafc; /* bg-slate-50 */
                }
            `}</style>
      <div className="w-full h-svh max-w-2xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center justify-center w-full flex-1 h-full">
          <div className="text-center">
            <div className="flex justify-between items-center mb-4">
              <div></div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                🎯 เกมจับคู่คำศัพท์
                {gameMode === 'marked' && (
                  <div className="text-sm font-normal text-orange-600 mt-1">
                    🔖 โหมดฝึกคำยาก
                  </div>
                )}
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMarkedWords(true)}
                  className="text-slate-500 hover:text-orange-600 text-xl"
                  title="ดูคำที่ mark ไว้"
                >
                  🔖
                </button>
                <button
                  onClick={() => setShowStats(true)}
                  className="text-slate-500 hover:text-slate-700 text-xl"
                  title="ดูสถิติ"
                >
                  📊
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm sm:text-base text-slate-500">
              {gameMode === 'marked' 
                ? 'ฝึกฝนเฉพาะคำที่คุณ mark ว่ายาก' 
                : 'เลือกคำศัพท์ภาษาอังกฤษและคำแปลภาษาไทยที่คู่กัน'
              }
            </p>
            <div className="mt-2 text-xs text-slate-400 space-y-1">
              {gameMode === 'marked' ? (
                <div>🔖 คำเหล่านี้จะช่วยเสริมจุดอ่อนของคุณ</div>
              ) : (
                <>
                  <div>💡 ระบบจะจำการเล่นของคุณและเลือกคำที่เหมาะสมให้</div>
                  <div>🔥 = คำยาก | ✨ = คำง่าย | 🔖 = คำที่ mark | 📊 = ดูสถิติ</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-8 w-full">
            <div
              className={`text-center h-8 mb-4 text-lg font-semibold transition-all ${
                message === "ถูกต้อง!" || message.startsWith("ยอดเยี่ยม")
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {message}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-4 w-full">
              <div className="flex flex-col space-y-4 w-full">
                <h3 className="text-center text-sm font-semibold text-slate-700 bg-blue-50 py-2 rounded-lg">
                  🇺🇸 English
                </h3>
                {englishWords.map((word) => (
                  <WordCard
                    key={word}
                    word={word}
                    lang="en"
                    onClick={handleCardClick}
                    isSelected={selectedCard?.word === word}
                    isCorrect={correctPairs.includes(word)}
                    isIncorrect={
                      incorrectPair?.word1 === word ||
                      incorrectPair?.word2 === word
                    }
                  />
                ))}
              </div>
              <div className="flex flex-col space-y-4 w-full">
                <h3 className="text-center text-sm font-semibold text-slate-700 bg-green-50 py-2 rounded-lg">
                  🇹🇭 ไทย
                </h3>
                {thaiWords.map((word) => (
                  <WordCard
                    key={word}
                    word={word}
                    lang="th"
                    onClick={handleCardClick}
                    isSelected={selectedCard?.word === word}
                    isCorrect={correctPairs.includes(word)}
                    isIncorrect={
                      incorrectPair?.word1 === word ||
                      incorrectPair?.word2 === word
                    }
                  />
                ))}
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={initGame}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                🔄 เริ่มใหม่
              </button>
              
              {/* ปุ่มสลับโหมดเล่นเฉพาะคำที่ mark */}
              {wordStatsManager.canPlayMarkedMode(10) && (
                <button
                  onClick={() => {
                    const newMode = gameMode === 'normal' ? 'marked' : 'normal';
                    setGameMode(newMode);
                    if (newMode === 'marked') {
                      setMessage("🔖 โหมดฝึกคำที่ mark ไว้");
                    } else {
                      setMessage("🎮 กลับสู่โหมดปกติ");
                    }
                    setTimeout(() => setMessage(""), 2000);
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                    gameMode === 'marked' 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  }`}
                >
                  {gameMode === 'marked' 
                    ? '🔖 กลับโหมดปกติ' 
                    : `🔖 โหมดคำยาก (${wordStatsManager.getMarkedWordsWithTranslations().length})`
                  }
                </button>
              )}
              
              <button
                onClick={() => {
                  if (selectedCard && selectedCard.lang === 'en') {
                    const newWeight = wordStatsManager.markAsDifficult(selectedCard.word);
                    setMessage(`🔖 "${selectedCard.word}" ถูกทำเครื่องหมายว่ายาก! (น้ำหนัก: ${newWeight.toFixed(1)})`);
                    setTimeout(() => setMessage(""), 2000);
                    // Force update stats modal
                    setStatsUpdateKey(prev => prev + 1);
                  }
                }}
                disabled={!selectedCard || selectedCard.lang !== 'en'}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                🔖 Mark ยาก
              </button>
              <button
                onClick={() => {
                  if (selectedCard && selectedCard.lang === 'en') {
                    speakWord(selectedCard.word);
                  }
                }}
                disabled={!selectedCard || selectedCard.lang !== 'en'}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                🔊 ฟังเสียง
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <StatsModal />
      <MarkedWordsModal />
    </>
  );
};

export default WordMatchGame;
