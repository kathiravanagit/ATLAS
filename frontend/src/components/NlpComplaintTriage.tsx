import { useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Send, Tag, AlertTriangle, Clock, MapPin, User, FileText, Bot } from 'lucide-react';
import { authFetch } from '@/lib/auth';

interface TriageResult {
  complaint_text: string;
  category: string;
  keyword_match_score: number;
  confidence_note?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  entities: { type: string; value: string }[];
  suggested_action: string;
  estimated_loss: string;
  timeline: string;
}

const DEMO_COMPLAINTS = [
  "I received a call from someone claiming to be from SBI asking for my OTP. After sharing it, Rs.45,000 was debited from my account.",
  "My credit card was used for international transactions of Rs.2,30,000 without my knowledge. I never left India.",
  "I invested Rs.5,00,000 in a crypto trading app recommended by a Telegram group. The app is now showing zero balance.",
  "Someone cloned my debit card and withdrew Rs.80,000 from an ATM in Chennai while I was in Delhi.",
  "I got an email saying I won a lottery of Rs.10,00,000. After paying processing fee of Rs.25,000, they stopped responding.",
  "My UPI ID was used to transfer Rs.35,000 to an unknown account. I never shared my PIN.",
];

function analyzeComplaint(text: string): TriageResult {
  const lower = text.toLowerCase();

  let category = 'General Cyber Fraud';
  let keyword_match_score = 0.65;

  if (lower.includes('otp') || lower.includes('called') || lower.includes('sharing')) {
    category = 'Vishing / Social Engineering';
    keyword_match_score = 0.92;
  } else if (lower.includes('credit card') || lower.includes('debit card') || lower.includes('cloned')) {
    category = 'Card Cloning / Skimming';
    keyword_match_score = 0.88;
  } else if (lower.includes('invest') || lower.includes('crypto') || lower.includes('trading')) {
    category = 'Investment Fraud';
    keyword_match_score = 0.91;
  } else if (lower.includes('upi') || lower.includes('pin')) {
    category = 'UPI Fraud';
    keyword_match_score = 0.87;
  } else if (lower.includes('lottery') || lower.includes('won') || lower.includes('processing fee')) {
    category = 'Advance Fee Fraud';
    keyword_match_score = 0.85;
  } else if (lower.includes('atm') || lower.includes('clone')) {
    category = 'ATM Skimming';
    keyword_match_score = 0.89;
  }

  const amountMatch = text.match(/Rs\.?[\d,]+/);
  const amount = amountMatch ? amountMatch[0] : 'Unknown';

  let priority: TriageResult['priority'] = 'Medium';
  const numericAmount = parseInt(amount.replace(/[Rs.,]/g, ''), 10);
  if (numericAmount > 200000) priority = 'Critical';
  else if (numericAmount > 50000) priority = 'High';
  else if (numericAmount > 10000) priority = 'Medium';
  else priority = 'Low';

  const entities: TriageResult['entities'] = [];
  if (amountMatch) entities.push({ type: 'AMOUNT', value: amount });
  if (lower.includes('sbi') || lower.includes('bank')) entities.push({ type: 'BANK', value: 'SBI' });
  if (lower.includes('chennai') || lower.includes('delhi') || lower.includes('pune')) {
    const city = lower.includes('chennai') ? 'Chennai' : lower.includes('delhi') ? 'Delhi' : 'Pune';
    entities.push({ type: 'LOCATION', value: city });
  }
  if (lower.includes('telegram')) entities.push({ type: 'PLATFORM', value: 'Telegram' });

  const actions = [
    'File FIR under IT Act Section 66D',
    'Block compromised card/account immediately',
    'Report to National Cyber Crime Portal',
    'Coordinate with bank fraud desk',
    'Initiate chargeback process',
    'Track suspicious UPI handles',
  ];

  return {
    complaint_text: text,
    category,
    keyword_match_score,
    priority,
    entities,
    suggested_action: actions[Math.floor(Math.random() * actions.length)],
    estimated_loss: amount,
    timeline: `${Math.floor(Math.random() * 48) + 1}h ago`,
  };
}

export default function NlpComplaintTriage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = (text: string) => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setResult(null);

    authFetch('/api/nlp/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const isUnrecognized = data.keyword_match_score <= 0.55 && data.category === 'General Cyber Fraud';
          setResult({
            complaint_text: text,
            category: isUnrecognized ? 'Unrecognized Complaint Format' : data.category,
            keyword_match_score: data.keyword_match_score,
            confidence_note: data.confidence_note,
            priority: isUnrecognized ? 'Low' : data.priority,
            entities: data.entities || [],
            suggested_action: isUnrecognized
              ? 'This complaint does not appear to be related to cybercrime. Please provide details related to UPI fraud, phishing, card cloning, SIM swap, identity theft, or investment fraud.'
              : data.suggested_action,
            estimated_loss: data.estimated_loss,
            timeline: `${Math.floor(Math.random() * 48) + 1}h ago`,
          });
        } else {
          setResult(analyzeComplaint(text));
        }
      })
      .catch(() => setResult(analyzeComplaint(text)))
      .finally(() => setAnalyzing(false));
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-[#f59e0b]" />
        <h3 className="text-base font-semibold text-[#1F2937]">Complaint Classification</h3>
        <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">Simulation</span>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 px-3 py-2 bg-[#F8F9FA] border border-[#D1D5DB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:border-[#9CA3AF] resize-none"
          rows={2}
          placeholder="Paste or type a cybercrime complaint..."
        />
        <button
          onClick={() => handleAnalyze(input)}
          disabled={analyzing || !input.trim()}
          className="px-4 py-2 bg-[#f59e0b] text-[#1F2937] text-sm font-medium rounded-lg hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center gap-1 self-end"
        >
          <Send size={12} />
          {analyzing ? 'Analyzing...' : 'Triage'}
        </button>
      </div>

      {/* Quick demos */}
      <div className="mb-4">
        <div className="text-[10px] text-[#6B7280] mb-1.5">Quick demo complaints:</div>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_COMPLAINTS.map((demo, i) => (
            <button
              key={i}
              onClick={() => { setInput(demo); handleAnalyze(demo); }}
              className="text-[11px] text-[#374151] bg-white border border-[#D1D5DB] px-2 py-1 rounded hover:bg-[#E5E7EB] hover:text-[#1F2937] transition-colors truncate max-w-[200px]"
              title={demo}
            >
              {demo.slice(0, 40)}...
            </button>
          ))}
        </div>
      </div>

      {/* Analyzing animation */}
      {analyzing && (
        <div className="bg-[#F8F9FA] rounded-lg p-8 border border-[#D1D5DB] flex items-center justify-center">
          <div className="text-center">
            <Bot size={24} className="text-[#f59e0b] animate-pulse mx-auto mb-2" />
            <div className="text-[11px] text-[#6B7280]">NLP model analyzing complaint...</div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !analyzing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {/* Priority + Category */}
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              result.priority === 'Critical' ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20' :
              result.priority === 'High' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20' :
              result.priority === 'Medium' ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20' :
              'bg-[#F3F4F6] text-[#6B7280] border border-[#71717a]'
            }`}>
              {result.priority === 'Critical' && <AlertTriangle size={12} className="inline mr-1" />}
              {result.priority}
            </div>
            <div className="flex-1">
              <div className="text-sm text-[#1F2937] font-medium">{result.category}</div>
              <div className="text-[10px] text-[#6B7280]">Keyword Match: {(result.keyword_match_score * 100).toFixed(0)}% <span className="text-[#9CA3AF]">(heuristic)</span></div>
            </div>
            <div className="text-right">
              <div className="text-sm text-[#1F2937] font-medium">{result.estimated_loss}</div>
              <div className="text-[10px] text-[#6B7280] flex items-center gap-1 justify-end">
                <Clock size={9} /> {result.timeline}
              </div>
            </div>
          </div>

          {/* Entities */}
          {result.entities.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-2">Extracted Entities</div>
              <div className="flex flex-wrap gap-2">
                {result.entities.map((ent, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white border border-[#D1D5DB] px-2 py-1 rounded text-[10px]">
                    {ent.type === 'AMOUNT' && <span className="text-[#f59e0b]">&#8377;</span>}
                    {ent.type === 'BANK' && <Tag size={9} className="text-[#3b82f6]" />}
                    {ent.type === 'LOCATION' && <MapPin size={9} className="text-[#22c55e]" />}
                    {ent.type === 'PLATFORM' && <FileText size={9} className="text-[#8b5cf6]" />}
                    <span className="text-[#6B7280]">{ent.type}:</span>
                    <span className="text-[#1F2937]">{ent.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested action */}
          <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Suggested Action</div>
            <div className="text-sm text-[#22c55e]">{result.suggested_action}</div>
          </div>

          {/* Original text */}
          <div className="bg-[#F8F9FA] rounded-lg p-3 border border-[#D1D5DB]">
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Original Complaint</div>
            <p className="text-[11px] text-[#374151] italic">"{result.complaint_text}"</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
