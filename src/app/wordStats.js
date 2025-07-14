// Word statistics management system
import { wordList } from './constanct';

class WordStatsManager {
  constructor() {
    this.storageKey = 'wordMatchGameStats';
    this.stats = this.loadStats();
    this.minWeight = 0.1; // น้อยสุด 10% ไม่ให้หายไปเลย
    this.maxWeight = 2.0;  // มากสุด 200% สำหรับคำที่ผิดบ่อย
  }

  // โหลดสถิติจาก localStorage
  loadStats() {
    if (typeof window === 'undefined') return {};
    
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn('Failed to load word stats:', error);
      return {};
    }
  }

  // บันทึกสถิติลง localStorage
  saveStats() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
    } catch (error) {
      console.warn('Failed to save word stats:', error);
    }
  }

  // รับสถิติของคำ หรือสร้างใหม่ถ้าไม่มี
  getWordStat(word) {
    if (!this.stats[word]) {
      this.stats[word] = {
        correct: 0,
        incorrect: 0,
        totalSeen: 0,
        lastSeen: 0,
        weight: 1.0
      };
    }
    return this.stats[word];
  }

  // บันทึกผลการตอบ
  recordAnswer(word, isCorrect) {
    const stat = this.getWordStat(word);
    
    if (isCorrect) {
      stat.correct++;
    } else {
      stat.incorrect++;
    }
    
    stat.totalSeen++;
    stat.lastSeen = Date.now();
    
    // คำนวณ weight ใหม่
    this.updateWeight(word);
    this.saveStats();
  }

  // คำนวณ weight สำหรับการสุ่ม
  updateWeight(word) {
    const stat = this.getWordStat(word);
    
    if (stat.totalSeen === 0) {
      stat.weight = 1.0;
      return;
    }

    // ถ้าคำนี้ถูก mark ไว้ ใช้กฎพิเศษ
    if (stat.markedDifficult && stat.markedDifficult > 0) {
      this.updateMarkedWordWeight(word);
      return;
    }

    // กฎปกติสำหรับคำที่ไม่ถูก mark
    const correctRate = stat.correct / stat.totalSeen;
    const incorrectRate = stat.incorrect / stat.totalSeen;
    
    let newWeight = 1.0;
    
    if (correctRate > 0.7) {
      // ถูกมากกว่า 70% ลด weight
      newWeight = 1.0 - (correctRate - 0.7) * 2;
    } else if (incorrectRate > 0.5) {
      // ผิดมากกว่า 50% เพิ่ม weight
      newWeight = 1.0 + (incorrectRate - 0.5) * 2;
    }
    
    // จำกัด weight ให้อยู่ในช่วงที่กำหนด
    stat.weight = Math.max(this.minWeight, Math.min(this.maxWeight, newWeight));
  }

  // ปรับ weight สำหรับคำที่ mark ไว้ (Progressive Learning)
  updateMarkedWordWeight(word) {
    const stat = this.getWordStat(word);
    
    // ถ้าไม่เคยเล่น ให้ weight สูง
    if (stat.totalSeen === 0) {
      stat.weight = 1.8; // สูงกว่าปกติ
      return;
    }

    const correctRate = stat.correct / stat.totalSeen;
    
    // ระบบ Progressive Learning: ต้องตอบถูกบ่อยและติดต่อกันถึงจะลด weight
    if (correctRate >= 0.85 && stat.totalSeen >= 8) {
      // ถูก 85%+ และเล่นอย่างน้อย 8 ครั้ง = ลดลงช้าๆ
      stat.weight = Math.max(1.2, stat.weight - 0.1);
    } else if (correctRate >= 0.75 && stat.totalSeen >= 6) {
      // ถูก 75-84% และเล่นอย่างน้อย 6 ครั้ง = ลดนิดหน่อย
      stat.weight = Math.max(1.4, stat.weight - 0.05);
    } else if (correctRate >= 0.65 && stat.totalSeen >= 4) {
      // ถูก 65-74% และเล่นอย่างน้อย 4 ครั้ง = คงที่
      // ไม่เพิ่ม ไม่ลด
    } else {
      // ยังตอบไม่ดีพอ = เพิ่ม weight
      stat.weight = Math.min(this.maxWeight, stat.weight + 0.15);
    }
    
    // Weight ขั้นต่ำสำหรับคำที่ mark คือ 1.2 (ไม่ลดต่ำกว่านี้)
    // เพื่อให้ยังคงเจอบ่อยกว่าคำปกติ
    stat.weight = Math.max(1.2, stat.weight);
    
    console.log(`Update marked word "${word}": accuracy=${Math.round(correctRate*100)}%, attempts=${stat.totalSeen}, weight=${stat.weight.toFixed(2)}`);
  }

  // ทำเครื่องหมายคำว่ายาก (เพิ่ม weight)
  markAsDifficult(word) {
    const stat = this.getWordStat(word);
    
    // เพิ่ม weight ขึ้น 0.3 หรือตั้งเป็น 1.5 ถ้าต่ำกว่า
    stat.weight = Math.max(1.5, stat.weight + 0.3);
    
    // จำกัดไม่ให้เกิน maxWeight
    stat.weight = Math.min(this.maxWeight, stat.weight);
    
    // บันทึกการ mark ไว้ในสถิติ
    if (!stat.markedDifficult) {
      stat.markedDifficult = 0;
    }
    stat.markedDifficult++;
    stat.lastMarked = Date.now();
    
    this.saveStats();
    return stat.weight;
  }

  // ลบการทำเครื่องหมายคำว่ายาก
  removeMarkAsDifficult(word) {
    const stat = this.getWordStat(word);
    
    if (stat.markedDifficult && stat.markedDifficult > 0) {
      // ลดจำนวนการ mark
      stat.markedDifficult--;
      
      // ถ้าไม่มีการ mark เหลืออยู่แล้ว ลบ properties ที่เกี่ยวข้อง
      if (stat.markedDifficult === 0) {
        delete stat.markedDifficult;
        delete stat.lastMarked;
      }
      
      // ปรับ weight ใหม่ตามสถิติการเล่น
      this.updateWeight(word);
      
      this.saveStats();
      return true;
    }
    
    return false;
  }

  // ได้รับ weight ของคำ
  getWordWeight(word) {
    return this.getWordStat(word).weight;
  }

  // ได้รับจำนวนคำทั้งหมดในฐานข้อมูล
  getTotalWordsCount() {
    return wordList.length;
  }

  // ตรวจสอบว่า wordList มีการเปลี่ยนแปลงหรือไม่
  getWordListInfo() {
    return {
      totalWords: wordList.length,
      lastUpdated: new Date().toLocaleString('th-TH'),
      sampleWords: wordList.slice(0, 5).map(item => item.en)
    };
  }

  // สุ่มคำตาม weight
  weightedRandomSelection(wordList, count = 4) {
    if (wordList.length <= count) {
      return [...wordList];
    }

    // คำนวณ weight รวม
    const weights = wordList.map(word => {
      const enWeight = this.getWordWeight(word.en);
      const thWeight = this.getWordWeight(word.th);
      // ใช้ weight เฉลี่ยของคู่คำ
      return (enWeight + thWeight) / 2;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const selected = [];
    const availableWords = [...wordList];
    const availableWeights = [...weights];

    for (let i = 0; i < count && availableWords.length > 0; i++) {
      const random = Math.random() * availableWeights.reduce((sum, w) => sum + w, 0);
      let currentWeight = 0;
      let selectedIndex = 0;

      for (let j = 0; j < availableWeights.length; j++) {
        currentWeight += availableWeights[j];
        if (random <= currentWeight) {
          selectedIndex = j;
          break;
        }
      }

      // เพิ่มคำที่เลือกได้
      selected.push(availableWords[selectedIndex]);
      
      // ลบออกจาก available arrays
      availableWords.splice(selectedIndex, 1);
      availableWeights.splice(selectedIndex, 1);
    }

    return selected;
  }

  // สุ่มเฉพาะคำที่ mark ไว้ (สำหรับโหมดฝึกคำยาก)
  markedWordsRandomSelection(count = 4) {
    const markedWords = this.getMarkedWordsWithTranslations();
    
    if (markedWords.length < count) {
      // ถ้าไม่มีคำ mark เพียงพอ ให้ return ทั้งหมดที่มี
      return markedWords.map(item => ({
        en: item.english,
        th: item.thai
      }));
    }

    // ถ้ามีพอ ให้สุ่มตาม weight (คำที่ยากกว่าจะถูกเลือกบ่อยกว่า)
    const weights = markedWords.map(item => {
      return this.getWordWeight(item.english);
    });

    const selected = [];
    const availableWords = [...markedWords];
    const availableWeights = [...weights];

    for (let i = 0; i < count && availableWords.length > 0; i++) {
      const totalWeight = availableWeights.reduce((sum, w) => sum + w, 0);
      const random = Math.random() * totalWeight;
      let currentWeight = 0;
      let selectedIndex = 0;

      for (let j = 0; j < availableWeights.length; j++) {
        currentWeight += availableWeights[j];
        if (random <= currentWeight) {
          selectedIndex = j;
          break;
        }
      }

      // เพิ่มคำที่เลือกได้
      selected.push({
        en: availableWords[selectedIndex].english,
        th: availableWords[selectedIndex].thai
      });
      
      // ลบออกจาก available arrays
      availableWords.splice(selectedIndex, 1);
      availableWeights.splice(selectedIndex, 1);
    }

    return selected;
  }

  // ตรวจสอบจำนวนคำที่ mark ว่าพอทำเกมหรือไม่
  canPlayMarkedMode(minWords = 10) {
    const markedWords = this.getMarkedWordsWithTranslations();
    return markedWords.length >= minWords;
  }

  // รีเซ็ตสถิติทั้งหมด
  resetStats() {
    this.stats = {};
    this.saveStats();
  }

  // ดูสถิติของคำทั้งหมด
  getAllStats() {
    return { ...this.stats };
  }

  // ดูสถิติสรุป
  getSummaryStats() {
    const words = Object.keys(this.stats);
    const totalWordsInDatabase = wordList.length; // คำนวณจาก wordList จริง
    
    // กรองเฉพาะคำภาษาอังกฤษที่เล่นแล้ว
    const englishWordsPlayed = words.filter(word => {
      const isEnglish = !/[\u0E00-\u0E7F]/.test(word);
      const hasBeenPlayed = this.stats[word].totalSeen > 0;
      return isEnglish && hasBeenPlayed;
    });
    
    if (englishWordsPlayed.length === 0) {
      return {
        totalWordsInDatabase,
        wordsPlayedCount: 0,
        totalAttempts: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        mostIncorrect: [],
        leastAccurate: [],
        needMorePractice: [],
        markedDifficult: []
      };
    }

    // คำนวณสถิติรวมจากคำภาษาอังกฤษเท่านั้น
    let totalAttempts = 0;
    let totalCorrect = 0;
    
    const detailedStats = englishWordsPlayed.map(word => {
      const stat = this.stats[word];
      totalAttempts += stat.totalSeen;
      totalCorrect += stat.correct;
      
      const correctRate = stat.correct / stat.totalSeen;
      return {
        word,
        correct: stat.correct,
        incorrect: stat.incorrect,
        totalSeen: stat.totalSeen,
        correctRate,
        incorrectRate: stat.incorrect / stat.totalSeen,
        weight: stat.weight
      };
    });

    // ฟิลเตอร์เฉพาะคำที่มีการตอบผิด
    const englishWordsWithErrors = detailedStats.filter(item => item.incorrect > 0);

    // เรียงตามจำนวนครั้งที่ตอบผิดมากที่สุด
    const mostIncorrect = englishWordsWithErrors
      .sort((a, b) => b.incorrect - a.incorrect)
      .slice(0, 10)
      .map(item => ({
        word: item.word,
        incorrectCount: item.incorrect,
        correctCount: item.correct,
        accuracy: Math.round(item.correctRate * 100)
      }));

    // เรียงตามอัตราความถูกต้องต่ำที่สุด (แต่ต้องเล่นอย่างน้อย 2 ครั้ง)
    const leastAccurate = englishWordsWithErrors
      .filter(item => item.totalSeen >= 2)
      .sort((a, b) => a.correctRate - b.correctRate)
      .slice(0, 10)
      .map(item => ({
        word: item.word,
        accuracy: Math.round(item.correctRate * 100),
        attempts: item.totalSeen,
        incorrectCount: item.incorrect
      }));

    // คำที่ต้องฝึกฝนเพิ่ม (accuracy < 70% และเล่นแล้วอย่างน้อย 3 ครั้ง)
    const needMorePractice = englishWordsWithErrors
      .filter(item => item.correctRate < 0.7 && item.totalSeen >= 3)
      .sort((a, b) => a.correctRate - b.correctRate)
      .map(item => ({
        word: item.word,
        accuracy: Math.round(item.correctRate * 100),
        attempts: item.totalSeen,
        weight: Math.round(item.weight * 100) / 100
      }));
    
    // คำที่ถูก mark ว่ายาก (รวมทั้งคำที่ยังไม่เคยเล่น)
    const allWords = Object.keys(this.stats);
    const markedDifficult = allWords
      .filter(word => {
        // กรองเฉพาะคำภาษาอังกฤษที่ถูก mark
        const isEnglish = !/[\u0E00-\u0E7F]/.test(word);
        const isMarked = this.stats[word].markedDifficult && this.stats[word].markedDifficult > 0;
        return isEnglish && isMarked;
      })
      .map(word => ({
        word,
        markedCount: this.stats[word].markedDifficult,
        weight: Math.round(this.stats[word].weight * 100) / 100,
        lastMarked: this.stats[word].lastMarked ? new Date(this.stats[word].lastMarked).toLocaleString('th-TH') : null
      }))
      .sort((a, b) => b.markedCount - a.markedCount);
    
    return {
      totalWordsInDatabase,
      wordsPlayedCount: englishWordsPlayed.length, // นับเฉพาะคำภาษาอังกฤษ
      totalAttempts, // ผลรวมจากคำภาษาอังกฤษเท่านั้น
      totalCorrect, // ผลรวมจากคำภาษาอังกฤษเท่านั้น
      overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      mostIncorrect,
      leastAccurate,
      needMorePractice,
      markedDifficult
    };
  }

  // ดึงคำที่ mark พร้อมคำแปล
  getMarkedWordsWithTranslations() {
    if (!this.stats || Object.keys(this.stats).length === 0) {
      return [];
    }
    
    const words = Object.keys(this.stats);
    
    // กรองเฉพาะคำภาษาอังกฤษที่ถูก mark
    const markedEnglishWords = words.filter(word => {
      const isEnglish = !/[\u0E00-\u0E7F]/.test(word);
      const isMarked = this.stats[word].markedDifficult && this.stats[word].markedDifficult > 0;
      return isEnglish && isMarked;
    });

    // หาคำแปลจาก wordList
    const markedWordsWithTranslations = markedEnglishWords.map(englishWord => {
      const wordPair = wordList.find(pair => pair.en === englishWord);
      const stat = this.stats[englishWord];
      
      return {
        english: englishWord,
        thai: wordPair ? wordPair.th : 'ไม่พบคำแปล',
        markedCount: stat.markedDifficult,
        weight: Math.round(stat.weight * 100) / 100,
        lastMarked: stat.lastMarked ? new Date(stat.lastMarked).toLocaleString('th-TH') : null,
        accuracy: stat.totalSeen > 0 ? Math.round((stat.correct / stat.totalSeen) * 100) : 0,
        attempts: stat.totalSeen
      };
    });

    // เรียงตามจำนวนครั้งที่ mark มากที่สุด
    return markedWordsWithTranslations.sort((a, b) => b.markedCount - a.markedCount);
  }
}

// Export singleton instance
export const wordStatsManager = new WordStatsManager();
