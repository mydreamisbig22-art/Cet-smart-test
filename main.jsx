import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";
import "./style.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function App() {
  const [fileNames, setFileNames] = useState([]);
  const [sourceText, setSourceText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(20);
  const [difficulty, setDifficulty] = useState("Mixed");
  const [language, setLanguage] = useState("Hindi");
  const [subject, setSubject] = useState("Auto-detect");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("cet-history") || "[]"));
  const [mode, setMode] = useState("setup");

  const score = useMemo(() => questions.reduce((n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0), 0), [questions, answers]);
  const attempted = Object.keys(answers).length;

  async function readFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setStatus("Reading your study material…");
    let combined = "";
    try {
      for (const file of files) {
        setFileNames(old => [...old.filter(x => x !== file.name), file.name]);
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          for (let p = 1; p <= pdf.numPages; p++) {
            setStatus(`Reading PDF page ${p} of ${pdf.numPages}…`);
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            let pageText = content.items.map(x => x.str).join(" ");
            if (pageText.trim().length < 30) {
              const viewport = page.getViewport({ scale: 1.6 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
              const result = await Tesseract.recognize(canvas, language === "Hindi" ? "hin+eng" : "eng");
              pageText = result.data.text;
            }
            combined += `\\n\\n[${file.name} — Page ${p}]\\n${pageText}`;
          }
        } else if (file.type.startsWith("image/")) {
          setStatus(`Reading image ${file.name} with OCR…`);
          const result = await Tesseract.recognize(file, language === "Hindi" ? "hin+eng" : "eng");
          combined += `\\n\\n[${file.name}]\\n${result.data.text}`;
        } else {
          throw new Error(`${file.name}: Please upload a PDF or image file.`);
        }
      }
      setSourceText(old => [old, combined].filter(Boolean).join("\\n\\n"));
      setStatus(`Successfully extracted text from ${files.length} file(s). Please review it before generating the test.`);
    } catch (e) {
      setStatus(e.message || "Could not read the file.");
    } finally { setBusy(false); }
  }

  async function generate() {
    if (sourceText.trim().length < 80) { setStatus("Please upload a readable PDF/photo or paste at least a few paragraphs first."); return; }
    setBusy(true); setStatus("AI is checking the source and preparing MCQs…");
    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, count, difficulty, language, subject }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not generate questions.");
      setQuestions(data.questions); setAnswers({}); setCurrent(0); setSubmitted(false); setMode("quiz");
      setStatus(data.note || `${data.generated} questions are ready.`);
    } catch (e) { setStatus(e.message); }
    finally { setBusy(false); }
  }

  function choose(index) {
    if (answers[current] !== undefined || submitted) return;
    setAnswers(old => ({ ...old, [current]: index }));
  }
  function finish() {
    setSubmitted(true); setMode("result");
    const record = { date: new Date().toLocaleString(), total: questions.length, score, accuracy: Math.round(score / questions.length * 100) };
    const next = [record, ...history].slice(0, 20);
    setHistory(next); localStorage.setItem("cet-history", JSON.stringify(next));
  }
  function retryWrong() {
    const wrong = questions.filter((q, i) => answers[i] !== q.correctIndex);
    if (!wrong.length) return;
    setQuestions(wrong); setAnswers({}); setCurrent(0); setSubmitted(false); setMode("quiz");
  }
  function reset() { setMode("setup"); setQuestions([]); setAnswers({}); setSubmitted(false); setStatus(""); }

  const q = questions[current];
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">C</div><div><b>CET SMART TEST</b><small>AI PRACTICE PLATFORM</small></div></div><span className="top-pill">RAJASTHAN CET · 12TH LEVEL</span></header>
    <main>
      {mode === "setup" && <>
        <section className="hero"><div className="eyebrow">YOUR PERSONAL AI EXAM COACH</div><h1>Turn your revision notes<br/><span>into smart MCQ tests.</span></h1><p>Upload a PDF, book photos or paste notes. Practice with instant feedback and explanations grounded in your material.</p></section>
        <section className="panel">
          <div className="section-head"><div><h2>1. Add your study material</h2><p>PDFs, scanned pages, photos or plain text</p></div><span className="step">01 / 03</span></div>
          <div className="upload-grid">
            <label className="upload-card"><div className="upload-icon">⇧</div><b>Upload PDF</b><small>Revision books and notes</small><input type="file" accept=".pdf,application/pdf" multiple onChange={e=>readFiles(e.target.files)}/></label>
            <label className="upload-card"><div className="upload-icon">▧</div><b>Upload photos</b><small>JPG, PNG · multiple images</small><input type="file" accept="image/*" multiple onChange={e=>readFiles(e.target.files)}/></label>
          </div>
          {fileNames.length > 0 && <div className="file-list">{fileNames.map(n=><span key={n}>✓ {n}</span>)}</div>}
          <div className="or-line"><span>OR PASTE YOUR TEXT</span></div>
          <textarea className="source-box" value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Paste your book notes or revision content here…"/>
          <div className="source-meta">{sourceText.length.toLocaleString()} characters extracted / pasted</div>
        </section>
        <section className="panel">
          <div className="section-head"><div><h2>2. Customize your test</h2><p>Choose how you want to practice</p></div><span className="step">02 / 03</span></div>
          <div className="settings-grid">
            <label>Number of questions<select value={count} onChange={e=>setCount(Number(e.target.value))}>{[10,20,30,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
            <label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{["Easy","Medium","Hard","Mixed"].map(x=><option>{x}</option>)}</select></label>
            <label>Question language<select value={language} onChange={e=>setLanguage(e.target.value)}><option>Hindi</option><option>English</option><option>Hinglish</option></select></label>
            <label>Subject (optional)<select value={subject} onChange={e=>setSubject(e.target.value)}>{["Auto-detect","Rajasthan GK","Indian History","Geography","Polity","Science","Reasoning","Hindi","English","Other"].map(x=><option>{x}</option>)}</select></label>
          </div>
          <button className="primary-btn" disabled={busy} onClick={generate}>{busy ? "PLEASE WAIT…" : "✦  GENERATE MY MCQ TEST"}</button>
          {status && <div className="status" role="status">{busy && <span className="spinner"/>}{status}</div>}
          <p className="privacy-note">Your files are processed for this session. Use only material you have permission to upload.</p>
        </section>
        <section className="history"><div className="section-head"><div><h2>Recent practice</h2><p>Your test history is saved in this browser</p></div></div>
          {history.length ? history.slice(0,5).map((h,i)=><div className="history-row" key={i}><span>{h.date}</span><b>{h.score}/{h.total}</b><span>{h.accuracy}% accuracy</span></div>) : <div className="empty">Your completed tests will appear here.</div>}
        </section>
      </>}
      {mode === "quiz" && q && <section className="panel quiz-panel">
        <div className="quiz-top"><button className="text-btn" onClick={reset}>← Exit test</button><span>QUESTION {current+1} OF {questions.length}</span><b>{attempted} answered</b></div>
        <div className="progress"><i style={{width:`${(current+1)/questions.length*100}%`}}/></div>
        <div className="question-label">{q.topic || "CET PRACTICE"}</div><h2 className="question">{q.question}</h2>
        <div className="options">{q.options.map((op,i)=>{const selected=answers[current]===i, done=answers[current]!==undefined; let cls="option"; if(done && i===q.correctIndex) cls+=" correct"; else if(selected && i!==q.correctIndex) cls+=" wrong"; return <button key={i} className={cls} onClick={()=>choose(i)} disabled={done}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{op}</span>{done && i===q.correctIndex && <b>✓</b>}{selected && i!==q.correctIndex && <b>✕</b>}</button>})}</div>
        {answers[current] !== undefined && <div className={`feedback ${answers[current]===q.correctIndex?"good":"bad"}`}><b>{answers[current]===q.correctIndex?"Correct answer!":"Not quite — the correct answer is highlighted."}</b><p>{q.explanation}</p>{q.sourceQuote && <small>From your material: “{q.sourceQuote}”</small>}</div>}
        <div className="quiz-actions"><button className="secondary-btn" disabled={current===0} onClick={()=>setCurrent(x=>x-1)}>Previous</button>{current<questions.length-1 ? <button className="primary-btn compact" disabled={answers[current]===undefined} onClick={()=>setCurrent(x=>x+1)}>Next question →</button> : <button className="primary-btn compact" disabled={attempted===0} onClick={finish}>Finish test</button>}</div>
      </section>}
      {mode === "result" && <section className="panel result-panel"><div className="result-icon">✓</div><div className="eyebrow">TEST COMPLETED</div><h1>Your practice summary</h1><div className="score">{score}<small> / {questions.length}</small></div><p className="accuracy">{Math.round(score/questions.length*100)}% accuracy</p><div className="stats"><div><b>{score}</b><span>Correct</span></div><div><b>{attempted-score}</b><span>Incorrect</span></div><div><b>{questions.length-attempted}</b><span>Unanswered</span></div></div>
        <div className="result-actions"><button className="primary-btn" onClick={retryWrong} disabled={score===questions.length}>Practice wrong answers</button><button className="secondary-btn" onClick={()=>{setCurrent(0);setMode("quiz");}}>Review answers</button><button className="secondary-btn" onClick={reset}>Create new test</button></div>
        <div className="review-list"><h3>Answer review</h3>{questions.map((item,i)=><div className="review-item" key={i}><b>{i+1}. {item.question}</b><p className={answers[i]===item.correctIndex?"review-good":"review-bad"}>{answers[i]===item.correctIndex?"Correct":"Your answer: "+(item.options[answers[i]] || "Not attempted")}</p><small>Correct: {item.options[item.correctIndex]}</small></div>)}</div>
      </section>}
    </main>
    <footer>Built for focused revision · CET SMART TEST <span>Study smart. Practice consistently.</span></footer>
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
