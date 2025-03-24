import { EMPTY_ADDRESS } from '@dfares/constants';
import { isLocatable } from '@dfares/gamelogic';
import { isUnconfirmedSetQuasarLootSilverTx } from '@dfares/serde';
import { LocationId, PlanetType } from '@dfares/types';
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { CenterBackgroundSubtext, Spacer } from '../Components/CoreUI';
import { AccountLabel } from '../Components/Labels/Labels';
import { LoadingSpinner } from '../Components/LoadingSpinner';
import { Row } from '../Components/Row';
import { Blue, Sub } from '../Components/Text';
import dfstyles from '../Styles/dfstyles';
import { useAccount, usePlanet, usePlayer, useUIManager } from '../Utils/AppHooks';
import { useEmitterValue } from '../Utils/EmitterHooks';
import { ModalHandle } from '../Views/ModalPane';

const StyledLootSilverPane = styled.div`
  & > div {
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    &:last-child > span {
      margin-top: 1em;
      text-align: center;
      flex-grow: 1;
    }

    &.margin-top {
      margin-top: 0.5em;
    }
  }
`;

const StyledSilverInput = styled.div`
  width: fit-content;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
`;

const InputWrapper = styled.div`
  width: 17em;
  margin-right: 0.5em;

  input[type='range'] {
    width: 100%;
    height: 4px;
    background: ${dfstyles.colors.borderDark};
    outline: none;
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${dfstyles.colors.dfblue};
      cursor: pointer;
    }
  }
`;

const AllBtn = styled.div`
  color: ${dfstyles.colors.subtext};
  font-size: ${dfstyles.fontSizeS};
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
`;

export function SetLootSilverPane({
  initialPlanetId,
  modal: _modal,
}: {
  modal?: ModalHandle;
  initialPlanetId: LocationId | undefined;
}) {
  const uiManager = useUIManager();
  const gameManager = uiManager.getGameManager();

  const planetId = useEmitterValue(uiManager.selectedPlanetId$, initialPlanetId);
  const account = useAccount(uiManager);
  const player = usePlayer(uiManager).value;
  const planetWrapper = usePlanet(uiManager, planetId);
  const planet = planetWrapper.value;

  const notice = (
    <CenterBackgroundSubtext width='100%' height='75px'>
      You can't <br /> loot silver on this planet.
    </CenterBackgroundSubtext>
  );
  if (!account || !player || !planet) return notice;

  const [amt, setAmt] = useState(0);
  const isLootOwnerEmpty = planet.lootOwner === EMPTY_ADDRESS;
  const value = planet.lootOwner !== EMPTY_ADDRESS ? amt - planet.lootSilver : 0;
  let scoreDisplay = '';

  if (planet.lootOwner !== account) {
    // If the lootOwner has changed
    scoreDisplay = `My Score +${amt}`;
  } else {
    // If the lootOwner has not changed
    scoreDisplay = `My Score ${value >= 0 ? `+${value}` : `-${Math.abs(value)}`}`;
  }

  const planetLocatableCheck = isLocatable(planet);
  const planetOwnerCheck = planet.owner === account;
  const planetTypeCheck = planet.planetType === PlanetType.SILVER_BANK;
  const planetDestoryCheck = !planet.destroyed && !planet.frozen;
  const silverAmountCheck = amt <= planet.lootSilver + planet.silver;

  const looting = useMemo(
    () => !!planet.transactions?.hasTransaction(isUnconfirmedSetQuasarLootSilverTx),
    [planet]
  );

  const operate = () => {
    if (!planet || !uiManager) return;
    uiManager.setQuasarLootSilver(planet.locationId, amt);
  };

  const disabled =
    !planetLocatableCheck ||
    !planetOwnerCheck ||
    !planetTypeCheck ||
    !planetDestoryCheck ||
    !silverAmountCheck ||
    looting;

  let content = <></>;

  if (looting) {
    content = <LoadingSpinner initialText={'Looting Silver... '} />;
  } else if (!planetLocatableCheck) {
    content = <> planet is not locatable</>;
  } else if (!planetOwnerCheck) {
    content = <> you don't own this planet </>;
  } else if (!planetTypeCheck) {
    content = <> only quasar</>;
  } else if (!planetDestoryCheck) {
    content = <> planet is destoryed or frozen</>;
  } else if (!silverAmountCheck) {
    content = <>please choose another silver amount</>;
  } else {
    content = <> Set Loot Silver {amt}</>;
  }

  // DEV_TODO add pane to set silver amount
  // DEV_TODO add necessary information
  if (planet) {
    return (
      <StyledLootSilverPane>
        <Row>Current Status</Row>

        <div>
          <Sub>Loot Owner</Sub>
          <span>
            <AccountLabel
              style={{ color: dfstyles.colors.subtext }}
              ethAddress={planet.lootOwner}
              includeAddressIfHasTwitter
            />
          </span>
        </div>

        <div>
          <Sub>Loot Silver</Sub>
          <span>{planet.lootSilver}</span>
        </div>

        <Spacer height={8} />

        <StyledSilverInput>
          <InputWrapper>
            <input
              type='range'
              onChange={(e) => {
                const value = Number(e.target.value) || 0;
                const maxValue = planet.lootSilver + planet.silver;
                setAmt(Math.max(0, Math.min(value, maxValue)));
              }}
              value={amt}
              min={0}
              max={planet.lootSilver + planet.silver}
              step={1}
            />
          </InputWrapper>
          <Btn onClick={() => setAmt(planet.lootSilver + planet.silver)}> All </Btn>
        </StyledSilverInput>

        <Spacer height={8} />

        <div>
          <Sub>Selected Amount: </Sub>
          <span>
            {' '}
            {amt} / {planet.lootSilver + planet.silver}{' '}
          </span>
        </div>

        <Spacer height={8} />

        <div>Expected Result: </div>

        <div>
          {planet.lootOwner !== account && planet.lootOwner !== EMPTY_ADDRESS && (
            <Blue>Previous Loot Owner's Score - {planet.lootSilver}</Blue>
          )}
        </div>

        <div>
          <Blue>{scoreDisplay}</Blue>
        </div>

        <Spacer height={8} />

        <div>
          <Sub style={{ color: dfstyles.colors.dfgreen }}>
            NOTE: loot silver will reveal this planet's location!
          </Sub>
        </div>

        <Spacer height={8} />

        <Btn disabled={disabled} onClick={operate}>
          {content}
        </Btn>
      </StyledLootSilverPane>
    );
  } else {
    return (
      <CenterBackgroundSubtext width='100%' height='75px'>
        Select a Planet
      </CenterBackgroundSubtext>
    );
  }
}
