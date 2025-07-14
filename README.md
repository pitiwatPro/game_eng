# 🎯 เกมจับคู่คำศัพท์อังกฤษ-ไทย

เกมฝึกฝนคำศัพท์ภาษาอังกฤษที่มีระบบเรียนรู้แบบปรับตัว (Adaptive Learning) และระบบสถิติครบครัน

## 🎮 การเล่นเกม

### พื้นฐาน
- เลือกคำภาษาอังกฤษและคำแปลภาษาไทยที่คู่กัน
- ระบบจะจำการเล่นและปรับความยากให้เหมาะสม
- คำที่ตอบผิดจะออกมาบ่อยขึ้น คำที่ตอบถูกจะออกมาน้อยลง

### ปุ่มควบคุม
- **🔄 เริ่มใหม่**: เริ่มรอบใหม่ด้วยคำใหม่
- **🔖 Mark ยาก**: ทำเครื่องหมายคำที่เลือกว่ายาก (เฉพาะคำอังกฤษ)
- **🔊 ฟังเสียง**: ฟังการออกเสียงคำอังกฤษ (Text-to-Speech)
- **📊 สถิติ**: ดูสถิติการเล่นแบบละเอียด
- **🔖 ไอคอน**: ดูรายการคำที่ mark ไว้

## 🧮 ระบบ Weight (น้ำหนักการสุ่ม)

### ค่า Weight หมายถึงอะไร?
- **Weight = โอกาสที่คำจะถูกสุ่มขึ้นมา**
- Weight สูง = เจอบ่อย, Weight ต่ำ = เจอน้อย
- ช่วงค่า: 0.1 - 2.0

### การคำนวณ Weight แบบปกติ

| สถานะ | เงื่อนไข | Weight | การคำนวณ |
|-------|----------|---------|----------|
| **เริ่มต้น** | ยังไม่เคยเล่น | **1.0** | ค่าเริ่มต้น |
| **ตอบถูกบ่อย** | accuracy > 70% | **ลดลง** | `1.0 - (accuracy - 0.7) × 2` |
| **ตอบผิดบ่อย** | incorrectRate > 50% | **เพิ่มขึ้น** | `1.0 + (incorrectRate - 0.5) × 2` |
| **ปกติ** | อื่นๆ | **1.0** | คงที่ |

### ตัวอย่าง Weight ปกติ
```
accuracy 90% → weight = 1.0 - (0.9 - 0.7) × 2 = 0.6
accuracy 50% → weight = 1.0 (ปกติ)
incorrectRate 80% → weight = 1.0 + (0.8 - 0.5) × 2 = 1.6
```

## 🔖 ระบบ Mark คำยาก (Progressive Learning)

### การ Mark คำ
```javascript
// เมื่อกด "Mark ยาก"
stat.weight = Math.max(1.5, stat.weight + 0.3);
stat.markedDifficult++; // เพิ่มจำนวนครั้งที่ mark
```

### ตัวอย่างการเพิ่ม Weight เมื่อ Mark

| ครั้งที่ | Weight เดิม | Weight ใหม่ | คำอธิบาย |
|---------|-------------|-------------|----------|
| Mark 1 | 1.0 | **1.5** | `Math.max(1.5, 1.0 + 0.3)` |
| Mark 2 | 1.5 | **1.8** | `Math.max(1.5, 1.5 + 0.3)` |
| Mark 3 | 1.8 | **2.0** | `Math.min(2.0, 1.8 + 0.3)` |
| Mark 4+ | 2.0 | **2.0** | ติดขีดจำกัดสูงสุด |

### Progressive Learning System

คำที่ mark ไว้จะใช้ระบบเรียนรู้แบบค่อยเป็นค่อยไป:

| ระดับความเก่ง | เงื่อนไข | การปรับ Weight | Weight ขั้นต่ำ |
|---------------|----------|----------------|----------------|
| **เริ่มต้น** | ยังไม่เคยเล่น | ตั้งเป็น **1.8** | - |
| **ยังไม่เก่ง** | accuracy < 65% | **+0.15** | 1.2 |
| **ปานกลาง** | accuracy 65-74% + เล่น 4+ ครั้ง | **คงเดิม** | 1.2 |
| **ดี** | accuracy 75-84% + เล่น 6+ ครั้ง | **-0.05** | 1.4 |
| **เก่งมาก** | accuracy 85%+ + เล่น 8+ ครั้ง | **-0.1** | 1.2 |

### ข้อสำคัญของระบบ Mark
1. **ไม่หายไปเลย**: Weight ขั้นต่ำคือ 1.2 (เจอบ่อยกว่าคำปกติ)
2. **ต้องตอบถูกบ่อยจริงๆ**: ถึงจะลด Weight
3. **ตอบผิด = เพิ่ม Weight**: กลับมาเจอบ่อยอีก
4. **ค่อยเป็นค่อยไป**: ลด Weight ช้าๆ ไม่กระโดด

## 📊 ระบบสถิติ

### สถิติหลัก
- **คำทั้งหมดในเกม**: จำนวนคำใน database (อัปเดตอัตโนมัติ)
- **คำอังกฤษที่เล่นแล้ว**: จำนวนคำอังกฤษที่เคยเจอในเกม
- **ตอบคำอังกฤษทั้งหมด**: จำนวนครั้งที่ตอบคำอังกฤษ (รวมถูก+ผิด)
- **ความแม่นยำรวม**: เปอร์เซ็นต์การตอบถูกคำอังกฤษ

### สถิติเฉพาะ

#### 🔥 คำอังกฤษที่ตอบผิดบ่อยที่สุด
- เรียงตามจำนวนครั้งที่ตอบผิด
- แสดงเฉพาะคำอังกฤษ (ไม่รวมคำไทย)
- แสดงเฉพาะคำที่ตอบผิดอย่างน้อย 1 ครั้ง

#### ⚠️ คำอังกฤษที่ความแม่นยำต่ำ
- เรียงตาม accuracy ต่ำสุด
- ต้องเล่นอย่างน้อย 2 ครั้ง

#### 💪 คำอังกฤษที่ควรฝึกฝนเพิ่ม
- accuracy < 70% และเล่นอย่างน้อย 3 ครั้ง
- ระบบจะให้เจอบ่อยขึ้นอัตโนมัติ

#### 🔖 คำอังกฤษที่ถูก Mark ว่ายาก
- รายการคำที่คุณ mark ไว้
- แสดง: จำนวนครั้งที่ mark, weight ปัจจุบัน, วันที่ mark ล่าสุด

## 🎲 ระบบ Weighted Random Selection

### วิธีการทำงาน
```javascript
// คำนวณ weight เฉลี่ยของคู่คำ
wordWeight = (englishWeight + thaiWeight) / 2

// สุ่มตาม weight
random = Math.random() * totalWeight
// เลือกคำที่ตำแหน่ง random
```

### ตัวอย่างการสุ่ม
ถ้ามีคำ 4 คำ:
- **hello** (weight: 2.0) = โอกาส 40%
- **cat** (weight: 1.5) = โอกาส 30%
- **dog** (weight: 1.0) = โอกาส 20%
- **book** (weight: 0.5) = โอกาส 10%

## 🎯 กลยุทธ์การเล่น

### สำหรับผู้เล่น
1. **Mark คำยาก**: คำที่จำยากให้ mark เพื่อเจอบ่อยขึ้น
2. **ฝึกสม่ำเสมอ**: ระบบจะปรับความยากให้เหมาะสม
3. **ดูสถิติ**: เช็คความก้าวหน้าและจุดที่ต้องปรับปรุง
4. **อดทน**: คำที่ mark จะลด weight ช้าๆ เมื่อตอบถูกบ่อย

### สำหรับการเรียนรู้
- **Spaced Repetition**: คำยากเจอบ่อย คำง่ายเจอน้อย
- **Progressive Learning**: ต้องพิสูจน์ความเก่งก่อนลด frequency
- **Adaptive Difficulty**: ระบบปรับเอง ไม่ต้องตั้งค่า

## 🔧 ข้อมูลเทคนิค

### Weight Range
- **ขั้นต่ำ**: 0.1 (คำง่ายมาก)
- **ปกติ**: 1.0 (คำใหม่)
- **Mark ขั้นต่ำ**: 1.2 (คำที่ mark แล้ว)
- **Mark เริ่มต้น**: 1.8 (คำที่เพิ่ง mark)
- **ขั้นสูงสุด**: 2.0 (คำยากมาก)

### การบันทึกข้อมูล
- **LocalStorage**: บันทึกในเครื่องผู้เล่น
- **Auto-save**: บันทึกอัตโนมัติทุกครั้งที่เล่น
- **Persistent**: ข้อมูลคงอยู่แม้ปิดเบราว์เซอร์

### Responsive Design
- **Mobile First**: เหมาะสำหรับมือถือ
- **Touch Friendly**: ปุ่มขนาดใหญ่
- **Cross Platform**: ใช้ได้ทุกอุปกรณ์

---

## Getting Started (สำหรับ Developer)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
