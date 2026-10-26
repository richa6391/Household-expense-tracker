import { Camera, Calendar, Logo, Share } from "@/components/Icons";
import StartButton from "@/components/StartButton";

export default function Landing() {
  return (
    <main className="page">
      <div className="brand">
        <span className="brand-mark">
          <Logo size={22} />
        </span>
        PaySlip for Help
      </div>

      <section className="hero">
        <h1>Know what you owe your helper, and what they owe you.</h1>
        <p>Snap the WhatsApp request. We track advances, loans and leave, and work out payday for you.</p>
      </section>

      <div className="card" aria-label="Example helper">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="helper-card">
            <span className="avatar">S</span>
            <div className="grow">
              <div className="name">Sunita</div>
              <div className="muted small">Maid · ₹18,000/month</div>
            </div>
          </div>
          <span className="tag">Example</span>
        </div>
        <div className="tiles">
          <div className="tile">
            <div className="k">Advance</div>
            <div className="v">₹6,000</div>
          </div>
          <div className="tile">
            <div className="k">Loan</div>
            <div className="v">₹14,000</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="muted small">Pay on 1 Nov</span>
          <strong style={{ fontSize: 20 }}>₹7,600</strong>
        </div>
      </div>

      <ul className="benefits">
        <li>
          <span className="ic"><Camera /></span>
          <span><strong>Screenshot to record.</strong> <span className="muted">AI reads WhatsApp and UPI screenshots or a typed line in English, Hindi or Hinglish.</span></span>
        </li>
        <li>
          <span className="ic"><Calendar /></span>
          <span><strong>Payday worked out.</strong> <span className="muted">Advance, loan instalment and leave days are cut correctly, every month.</span></span>
        </li>
        <li>
          <span className="ic"><Share /></span>
          <span><strong>Share a clear statement.</strong> <span className="muted">Send it on WhatsApp in Hindi or English, so there are no arguments.</span></span>
        </li>
      </ul>

      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <StartButton />
          <p className="center muted tiny" style={{ margin: "8px 0 0" }}>No account needed. Your data stays on this phone.</p>
        </div>
      </div>
    </main>
  );
}
