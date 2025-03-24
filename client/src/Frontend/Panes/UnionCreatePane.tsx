import { TOKEN_NAME } from '@dfares/constants';
import { weiToEth } from '@dfares/network';
import { Setting } from '@dfares/types';
import { BigNumber } from 'ethers';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { Spacer } from '../Components/CoreUI';
import { DarkForestTextInput, TextInput } from '../Components/Input';
import { LoadingSpinner } from '../Components/LoadingSpinner';
import { Sub } from '../Components/Text';
import { useAccount, usePlayer, useUIManager } from '../Utils/AppHooks';
import { useEmitterValue } from '../Utils/EmitterHooks';
import { useBooleanSetting } from '../Utils/SettingsHooks';

const UnionCreateContent = styled.div`
  width: 600px;
  /* height: 300px; */
  overflow-y: scroll;
  display: flex;
  flex-direction: column;

  /* text-align: justify; */
  margin-top: 1em;
  margin-left: 1em;
  margin-right: 1em;
`;

const StyledUnionCreatePane = styled.div`
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

type SetStateFunction = (value: string) => void;

export function UnionCreatePane({
  setSelectedUnionId,
  setActiveFrame,
}: {
  setSelectedUnionId: SetStateFunction;
  setActiveFrame: SetStateFunction;
}) {
  const uiManager = useUIManager();
  const gameManager = uiManager.getGameManager();
  const account = useAccount(uiManager);
  const player = usePlayer(uiManager).value;

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [unionCreateFee, setUnionCreateFee] = useState<number | undefined>(undefined);
  const [unionNameText, setUnionNameText] = useState('');

  const [savedSettingValue, setSavedSettingValue] = useState(false);
  const [settingValue, setSettingValue] = useBooleanSetting(
    uiManager,
    Setting.DisableDefaultShortcuts
  );

  const balanceEth = weiToEth(
    useEmitterValue(uiManager.getEthConnection().myBalance$, BigNumber.from('0'))
  );

  const getUnionCreateFee = async () => {
    const unionCreatFee = await gameManager.getUnionCreationFee();
    return weiToEth(unionCreatFee);
  };

  const checkUnion = (): boolean => {
    if (!player) return false;
    return Number(player.unionId) === 0;
  };
  const checkEth = (): boolean => {
    if (unionCreateFee === undefined) return false;
    return balanceEth >= unionCreateFee;
  };

  const handleKeyDown = () => {
    console.log('handle key down');
    console.log(settingValue);
    setSettingValue(true);
    console.log('become true');
  };

  const handleKeyUp = () => {
    console.log('handle key up');
    console.log(savedSettingValue);
    setSettingValue(savedSettingValue);
  };

  const handleCreateUnion = async () => {
    setIsProcessing(true);
    try {
      await gameManager.createUnion(unionNameText);
    } catch (err) {
      console.error('Error creating union: ' + err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const fee = await getUnionCreateFee();
        setUnionCreateFee(fee);
      } catch (err) {
        console.error('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    setSavedSettingValue(settingValue);
  }, []);

  if (!account || !player) return <></>;

  if (loading) return <LoadingSpinner initialText={'Loading...'} />;

  let buttonContent = <></>;

  if (isProcessing) {
    buttonContent = <LoadingSpinner initialText='Processing...' />;
  } else if (!checkEth()) {
    buttonContent = <div> {'Not Enough ' + TOKEN_NAME}</div>;
  } else if (!checkUnion()) {
    buttonContent = <div> {'Already in other union'}</div>;
  } else {
    buttonContent = <div>{'Create Union'}</div>;
  }

  return (
    <UnionCreateContent>
      <StyledUnionCreatePane>
        <div>
          <Sub> Player UnionId: </Sub>
          <span>{player.unionId === '0' ? 'n/a' : player.unionId}</span>
        </div>
        <div>
          <Sub> Creation Cost: </Sub>
          <span>
            {unionCreateFee} ${TOKEN_NAME}
          </span>
        </div>

        <div>
          <Sub>Current Balance: </Sub>
          <span>
            {balanceEth} ${TOKEN_NAME}
          </span>
        </div>

        <div>
          <span>
            <TextInput
              placeholder='Union Name'
              value={unionNameText ?? ''}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onChange={(e: Event & React.ChangeEvent<DarkForestTextInput>) => {
                setUnionNameText(e.target.value);
              }}
            />
          </span>
          <Btn onClick={handleCreateUnion} disabled={!(checkUnion() && checkEth())}>
            {buttonContent}
          </Btn>
        </div>

        {!checkUnion() && (
          <div>
            <Btn
              size='large'
              onClick={() => {
                setSelectedUnionId(player.unionId);
                console.log(player.unionId);
                setActiveFrame('detail');
              }}
            >
              Jump to My Union 🌸
            </Btn>
          </div>
        )}
        <Spacer height={8} />
      </StyledUnionCreatePane>
    </UnionCreateContent>
  );
}
