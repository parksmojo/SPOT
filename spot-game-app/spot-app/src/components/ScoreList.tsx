import React from 'react';
import { IonBadge, IonCol, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { PlayerStatusData } from './Interfaces';
import { GameVals } from './GameVals';

function ScoreList(sortedPSDs:PlayerStatusData[], gameType: number) {
  
  return (
    <IonList>
      <IonListHeader className='lb-header'>
        <IonCol className='lb-col'>
          Username
        </IonCol>
        <IonCol className='lb-col'>
          Score
        </IonCol>
      </IonListHeader>
      {sortedPSDs.map((PSD) => (
        <IonItem key={PSD.username}>
          <IonCol className='lb-col'>
            <IonBadge className='lb-name-badge' style={{background: PSD.team}}>
              {PSD.username}
            </IonBadge>
          </IonCol>
          <IonCol className='lb-col'>
            {PSD.score}{gameType === GameVals.KING_OF_THE_HILL ? '%' : null}
          </IonCol>
        </IonItem>
      ))}
    </IonList>
  );
}

export default ScoreList;