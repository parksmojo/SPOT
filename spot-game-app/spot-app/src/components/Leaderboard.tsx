import React from 'react';
import { IonBadge, IonCol, IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { cellular, warning, wifi } from 'ionicons/icons';
import { ServerFacade } from './ServerFacade';

interface PlayerStatusData {
  username:string,
  player_state:string,
  score:number,
  comm_interval:number | null,
  lat:number,
  long:number,
  team:string
}

function Leaderboard(sortedPSDs:PlayerStatusData[]) {

  const pingCalc = (PSD:any) => {
    const commsDelay = PSD.time_since_comms_log;
    const geoDelay = 0 //PSD.time_since_geo_log;
    const delay = Math.max(commsDelay, geoDelay);
    if(delay < 2000){
      return '#06b434';
    } else if(delay < 10000){
      return '#FFD700';
    } else {
      return 'crimson';
    }
  }

  let unit = '';
    switch (ServerFacade.getGameType()){
        case 1:
            unit = '%';
            break;
        default:
            break;
    }
  
  return (
    <IonList>
      <IonListHeader className='lb-header'>
        <IonCol className='lb-col'>
          Username
        </IonCol>
        <IonCol className='lb-col'>
          Score
        </IonCol>
        <IonCol>
          Connection
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
            {PSD.score}{unit}
          </IonCol>
          <IonCol className='lb-col'>
            { (parseInt(PSD.player_state,2) & 1) === 0 ?
              <IonIcon icon={warning} style={{color: 'crimson'}}></IonIcon> :
              <IonIcon icon={wifi} style={{color: pingCalc(PSD)}}></IonIcon>
            }
          </IonCol>
        </IonItem>
      ))}
    </IonList>
  );
}

export default Leaderboard;