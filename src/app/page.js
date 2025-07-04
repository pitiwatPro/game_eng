"use client";

import React, { useState, useEffect, useRef } from "react";
import { wordList } from "./constanct";

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
      "card border-2 bg-white rounded-xl p-3 sm:p-4 text-center cursor-pointer text-base sm:text-lg font-medium text-slate-700 transition-all duration-200 ease-in-out";
    if (isCorrect)
      return `${baseClass} border-emerald-400 bg-green-50 text-green-800 opacity-80 cursor-not-allowed`;
    if (isIncorrect)
      return `${baseClass} border-red-400 bg-red-50 animate-shake`;
    if (isSelected)
      return `${baseClass} border-blue-500 bg-blue-50 transform -translate-y-0.5 scale-105 shadow-lg`;
    return `${baseClass} border-slate-200 hover:border-blue-400 hover:-translate-y-0.5`;
  };

  return (
    <div className={getCardClass()} onClick={() => onClick({ word, lang })}>
      {word}
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

    const newWordPairs = shuffleArray(wordList).slice(0, 4);
    setCurrentWords(newWordPairs);
    setEnglishWords(shuffleArray(newWordPairs.map((p) => p.en)));
    setThaiWords(shuffleArray(newWordPairs.map((p) => p.th)));

    setTimeout(() => setIsChecking(false), 500);
  };

  // Initialize game on component mount
  useEffect(() => {
    initGame();
  }, []);

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
    if (
      isChecking ||
      correctPairs.includes(card.word) ||
      correctPairs.includes(currentWords.find((p) => p.th === card.word)?.en)
    )
      return;

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
      if (selectedCard.lang === card.lang) {
        setSelectedCard(card);
        synths.current?.select.triggerAttackRelease("G5", "32n");
        return;
      }

      setIsChecking(true);

      const [first, second] =
        selectedCard.lang === "en"
          ? [selectedCard, card]
          : [card, selectedCard];
      const isMatch = currentWords.some(
        (p) => p.en === first.word && p.th === second.word
      );

      if (isMatch) {
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
          }, 800);
        }
      } else {
        setIncorrectPair({ word1: selectedCard.word, word2: card.word });
        setMessage("พยายามอีกครั้ง!");
        synths.current?.incorrect.triggerAttackRelease("A2", "16n");
        setTimeout(() => {
          setIncorrectPair(null);
          setSelectedCard(null);
          setMessage("");
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  if (!isClient) {
    return null; // Render nothing on the server
  }

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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
              เกมจับคู่คำศัพท์
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500">
              เลือกคำศัพท์ภาษาอังกฤษและคำแปลภาษาไทยที่คู่กัน
            </p>
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
          </div>
        </div>
      </div>
    </>
  );
};

export default WordMatchGame;
