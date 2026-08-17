"use client";

export default function BeegoMascotBubble({ message }) {
  return (
    <div className="beego-learn-mascot" aria-hidden>
      <div className="beego-learn-mascot__bubble">
        <p>{message}</p>
      </div>
      <span className="beego-learn-mascot__bee">🐝</span>
    </div>
  );
}
