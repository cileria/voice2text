import React from "react";

export const TimerIcon: React.FC = () => (
  <svg
    width="92"
    height="21"
    viewBox="0 0 92 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="flex items-center gap-[7px]"
  >
    <path
      d="M14.1668 6.54883L5.8335 14.8822M5.8335 6.54883L14.1668 14.8822"
      stroke="#003967"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <text
      fill="#003967"
      xmlSpace="preserve"
      style={{ whiteSpace: "pre" }}
      fontFamily="Inter"
      fontSize="14"
      fontWeight="500"
      letterSpacing="0em"
    >
      <tspan x="27" y="15.8067">
        00:12
      </tspan>
    </text>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M82 0.71582C87.5142 0.71582 92 5.20171 92 10.7158C92 16.23 87.5142 20.7158 82 20.7158C76.4859 20.7158 72 16.23 72 10.7158C72 5.20171 76.4859 0.71582 82 0.71582ZM82 1.89229C77.1341 1.89229 73.1765 5.84994 73.1765 10.7158C73.1765 15.5817 77.1341 19.5394 82 19.5394C86.8658 19.5394 90.8235 15.5817 90.8235 10.7158C90.8235 5.84994 86.8658 1.89229 82 1.89229ZM82 5.16027C85.0682 5.16027 87.5555 7.64757 87.5555 10.7158C87.5555 13.784 85.0682 16.2713 82 16.2713C78.9318 16.2713 76.4444 13.784 76.4444 10.7158C76.4444 7.64757 78.9318 5.16027 82 5.16027Z"
      fill="#003967"
    />
  </svg>
);
