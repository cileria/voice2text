"use client";
import * as React from "react";
import styled from "styled-components";
import { TimerIcon } from "./Icons/TimerIcon";
import { WaveformIcon } from "./Icons/WaveformIcon";
import { CheckCircleIcon } from "./Icons/CheckCircleIcon";
import { SendIcon } from "./Icons/SendIcon";

const AudioInputControl: React.FC = () => {
  return (
    <Container>
      <ControlsSection>
        <TimerIcon />
        <WaveformIcon />
        <CheckCircleIcon />
      </ControlsSection>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  gap: 8px;
  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const ControlsSection = styled.div`
  display: flex;
  width: 226px;
  height: 41px;
  padding: 8px;
  align-items: center;
  gap: 16px;
  border-radius: 4px;
  border: 1px solid var(--Primary-500, #003967);
  background-color: rgba(221, 237, 252, 0.3);
`;

const ActionSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SaveButton = styled.button`
  display: inline-flex;
  padding: 11.216px 17.946px;
  justify-content: center;
  align-items: center;
  gap: 8.973px;
  border-radius: 8.973px;
  border: 1.122px solid var(--Primary-500, #003967);
  opacity: 0.25;
  background-color: #003967;
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  height: 45px;
  position: relative;
`;

const SaveButtonText = styled.span`
  color: #fff;
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
`;

const AIFormatButton = styled.button`
  color: #fff;
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  padding: 11.216px 17.946px;
  gap: 8.973px;
  border-radius: 8.973px;
  border: 1.122px solid var(--Primary-500, #003967);
  background-color: #003967;
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  height: 45px;
`;

export default AudioInputControl;
