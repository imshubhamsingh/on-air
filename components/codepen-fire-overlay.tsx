"use client"

// This function generates the CSS for the 20 figure elements,
// mimicking the SCSS @for loop.
const generateFigureStyles = () => {
  let styles = ""
  for (let i = 1; i <= 20; i++) {
    const delay = Math.random() * 4
    const left = Math.random() * 100
    styles += `
      .fire > figure:nth-of-type(${i}) {
        animation-delay: ${delay.toFixed(2)}s;
        left: ${left.toFixed(2)}%;
      }
    `
  }
  return styles
}

export function CodePenFireOverlay() {
  const figureStyles = generateFigureStyles()

  return (
    <>
      <style jsx global>{`
        /* Base styles adapted from the CodePen */
        .fire-overlay-container {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end; /* Position fire at the bottom */
          background-color: rgba(20, 20, 20, 0.85);
          backdrop-filter: blur(4px);
          overflow: hidden;
        }

        .fire {
          margin: 0 auto;
          position: relative;
          width: 200px;
          height: 200px;
          transform: scale(1.5); /* Make it a bit larger */
        }

        .fire > figure {
          position: absolute;
          background: #ffa500; /* $c1 */
          width: 4px;
          height: 4px;
          border-radius: 2px;
          box-shadow:
            0 0 10px 0 #ffa500, /* $c1 */
            0 0 20px 0 #ffa500, /* $c1 */
            0 0 30px 0 #ffa500, /* $c1 */
            0 0 40px 0 #ff4500; /* $c2 */
          animation: fire 2s ease-in-out infinite;
        }

        .fire > .bottom {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 20px;
          background: #ff4500; /* $c2 */
          border-radius: 50%;
          filter: blur(5px);
        }

        /* Generated styles for each flame particle */
        ${figureStyles}

        .loading-text-container {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: white;
        }

        .loading-text-container p {
          color: #ddd;
          text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        }

        .loading-text-container h2 {
          font-size: 1.75rem; /* text-2xl */
          font-weight: 600; /* semibold */
          animation: firelight 2s ease-in-out infinite;
        }

        /* Keyframes from the CodePen */
        @keyframes fire {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-180px) scale(4);
            opacity: 0;
          }
        }

        @keyframes firelight {
          0% {
            text-shadow: 0 0 10px #ffa500, 0 0 15px #ff4500;
            color: #fff;
          }
          50% {
            text-shadow: 0 0 12px #ffa500, 0 0 20px #ff4500;
            color: #f0f0f0;
          }
          100% {
            text-shadow: 0 0 10px #ffa500, 0 0 15px #ff4500;
            color: #fff;
          }
        }
      `}</style>
      <div className="fire-overlay-container">
        <div className="loading-text-container">
          <h2>Stoking the AI flames...</h2>
          <p>Your roast is cooking!</p>
        </div>
        <div className="fire">
          <div className="bottom" />
          {/* Generate 20 figure elements for the flames */}
          {Array.from({ length: 20 }).map((_, i) => (
            <figure key={i} />
          ))}
        </div>
      </div>
    </>
  )
}
