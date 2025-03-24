import { LocationId, TooltipName } from '@dfares/types';
import React, { useCallback } from 'react';
import { SetLootSilverPane } from '../Panes/SetLootSIlverPane';
import { TooltipTrigger } from '../Panes/Tooltip';
import { TOGGLE_LOOT_SILVER_PANE } from '../Utils/ShortcutConstants';
import { ModalHandle } from '../Views/ModalPane';
import { MaybeShortcutButton } from './MaybeShortcutButton';

export function OpenSetLootSilverButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  const title = 'Loot Silver';
  const shortcut = TOGGLE_LOOT_SILVER_PANE;

  const open = useCallback(() => {
    const element = () => <SetLootSilverPane modal={modal} initialPlanetId={planetId} />;
    const helpContent = <></>;

    modal.push({
      title,
      element,
      helpContent,
    });
  }, [modal, planetId]);

  return (
    <MaybeShortcutButton
      size='stretch'
      onClick={open}
      onShortcutPressed={open}
      shortcutKey={shortcut}
      shortcutText={shortcut}
    >
      <TooltipTrigger
        name={TooltipName.LootSilver}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {title}
      </TooltipTrigger>
    </MaybeShortcutButton>
  );
}
