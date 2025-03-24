import { ModalName, Union, UnionId } from '@dfares/types';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { useAccount, useUIManager } from '../Utils/AppHooks';
import { ModalPane } from '../Views/ModalPane'; // Import ModalPane and ModalHandle
import { UnionCreatePane } from './UnionCreatePane';
import { UnionDetailPane } from './UnionDetailPane';
import { UnionListPane } from './UnionListPane';
import { UnionManagePane } from './UnionManagePane';

const ButtonContainer = styled.div`
  display: flex;
  gap: 10px; /* Set the spacing between buttons */
`;

const Frame = styled.div<{ visible: boolean }>`
  display: ${(props) => (props.visible ? 'block' : 'none')};
`;

export default function UnionContextPane({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);
  const [activeFrame, setActiveFrame] = useState('list'); // State to manage active frame

  const [union, setUnion] = useState<Union>();
  const [selectedUnionId, setSelectedUnionId] = useState('0');

  // update planet list on open / close
  useEffect(() => {
    if (!visible) return;
    if (!account || !uiManager) return;
    const unionId = uiManager.getPlayerUnionId(account);

    if (unionId) setSelectedUnionId(unionId);

    const union = uiManager.getUnion(unionId);
    setUnion(union);

    const player = uiManager.getPlayer(account);
    if (player && player.unionId === '0') setActiveFrame('create');
  }, [visible, account, uiManager]);

  // refresh planets every 10 seconds
  useEffect(() => {
    if (!visible) return;
    if (!account || !uiManager) return;

    const refreshUnion = () => {
      if (!account || !uiManager) return;
      const unionId = uiManager.getPlayerUnionId(account);
      const union = uiManager.getUnion(unionId);
      setUnion(union);
    };

    const intervalId = setInterval(refreshUnion, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [visible, account, uiManager]);

  if (!account) return <></>;

  const handleFrameChange = async (frame: string) => {
    setActiveFrame(frame);

    const unionId = uiManager.getPlayerUnionId(account);
    const union = uiManager.getUnion(unionId);
    setUnion(union);
  };

  const inUnion = (): boolean => {
    const player = uiManager.getPlayer(account);
    if (!player) return false;
    return player.unionId !== '0';
  };

  return (
    <ModalPane
      id={ModalName.UnionContextPane}
      title={'Union System'}
      visible={visible}
      onClose={onClose}
    >
      <ButtonContainer>
        {!inUnion() && <Btn onClick={() => handleFrameChange('create')}>Create</Btn>}
        <Btn onClick={() => handleFrameChange('list')}> List</Btn>
        {/* <Btn onClick={() => handleFrameChange('detail')}> Detail</Btn> */}
        <Btn onClick={() => handleFrameChange('manage')}>Manage</Btn>
      </ButtonContainer>

      <Frame visible={activeFrame === 'create'}>
        <UnionCreatePane setSelectedUnionId={setSelectedUnionId} setActiveFrame={setActiveFrame} />
      </Frame>

      <Frame visible={activeFrame === 'list'}>
        <UnionListPane setSelectedUnionId={setSelectedUnionId} setActiveFrame={setActiveFrame} />
      </Frame>

      <Frame visible={activeFrame === 'detail'}>
        <UnionDetailPane
          _unionId={selectedUnionId as UnionId}
          setSelectedUnionId={setSelectedUnionId}
          setActiveFrame={setActiveFrame}
        />
      </Frame>

      <Frame visible={activeFrame === 'manage'}>
        <UnionManagePane />
      </Frame>
    </ModalPane>
  );
}
