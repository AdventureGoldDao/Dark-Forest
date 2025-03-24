import { TooltipName } from '@dfares/types';
import React from 'react';
import styled from 'styled-components';
import { TooltipTrigger } from '../../Panes/Tooltip';
import dfstyles from '../../Styles/dfstyles';

const StyledSilverLabel = styled.span`
  color: ${dfstyles.colors.dfyellow};
`;
export const SilverLabel = () => <StyledSilverLabel>Score</StyledSilverLabel>;
export const LootSilverLabel = () => <StyledSilverLabel>LootSilver</StyledSilverLabel>;

export const SilverLabelTip = () => (
  <TooltipTrigger name={TooltipName.Silver}>
    <SilverLabel />
  </TooltipTrigger>
);

export const LootSilverLabelTip = () => (
  <TooltipTrigger name={TooltipName.PlayerLootSilver}>
    <SilverLabel />
  </TooltipTrigger>
);

const StyledScoreLabel = styled.span`
  color: ${dfstyles.colors.dfyellow};
  -webkit-text-stroke: 1px;
`;
export const ScoreLabel = () => <StyledScoreLabel>Score</StyledScoreLabel>;

export const ScoreLabelTip = () => (
  <TooltipTrigger name={TooltipName.Score}>
    <ScoreLabel />
  </TooltipTrigger>
);
