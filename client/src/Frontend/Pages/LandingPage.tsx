import { PLAYER_GUIDE } from '@dfares/constants';
import { CONTRACT_ADDRESS } from '@dfares/contracts';
import { address } from '@dfares/serde';
import React from 'react';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import { Link, Spacer, Title } from '../Components/CoreUI';
import { Modal } from '../Components/Modal';
import dfstyles from '../Styles/dfstyles';
import { LandingPageRoundArt } from '../Views/LandingPageRoundArt';

export const enum LandingPageZIndex {
  Background = 0,
  Canvas = 1,
  BasePage = 2,
}

const DFOfficeLinks = {
  twitter: 'http://twitter.com/darkforest_eth',
  email: 'mailto:ivan@0xparc.org',
  blog: 'https://blog.zkga.me/',
  discord: 'https://discord.gg/2u2TN6v8r6',
  github: 'https://github.com/darkforest-eth',
  wiki: 'https://dfwiki.net/wiki/Main_Page',
  plugins: 'https://plugins.zkga.me/',
};

const DFArchonLinks = {
  twitter: 'https://twitter.com/DFArchon',
  email: 'mailto:dfarchon@gmail.com',
  blog: 'https://mirror.xyz/dfarchon.eth',
  discord: 'https://discord.com/invite/XpBPEnsvgX',
  github: 'https://github.com/dfarchon',
  wiki: 'https://dfwiki.net/wiki/Main_Page',
  plugins: 'https://dfares-plugins.netlify.app/',
  guide: PLAYER_GUIDE,
};

const defaultAddress = address(CONTRACT_ADDRESS);

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-direction: row;

  @media only screen and (max-device-width: 1000px) {
    grid-template-columns: auto;
    flex-direction: column;
  }

  --df-button-color: ${dfstyles.colors.dfgreen};
  --df-button-border: 1px solid ${dfstyles.colors.dfgreen};
  --df-button-hover-background: ${dfstyles.colors.dfgreen};
  --df-button-hover-border: 1px solid ${dfstyles.colors.dfgreen};
`;

export default function LandingPage() {
  const history = useHistory();

  return (
    <>
      {/* <PrettyOverlayGradient /> */}
      {/* <Hiring /> */}

      <Page>
        <OnlyMobile>
          <Spacer height={8} />
        </OnlyMobile>
        <HideOnMobile>
          <Spacer height={100} />
        </HideOnMobile>

        <MainContentContainer>
          <Header>
            {/* <LinkContainer>
              <Link to={DFArchonLinks.email}>email</Link>
              <Spacer width={4} />
              <Link to={DFArchonLinks.blog}>blog</Link>
              <Spacer width={4} />

              <a className={'link-twitter'} href={DFArchonLinks.twitter}>
                <span className={'icon-twitter'}></span>
              </a>
              <Spacer width={4} />
              <a className={'link-discord'} href={DFArchonLinks.discord}>
                <span className={'icon-discord'}></span>
              </a>
              <Spacer width={4} />
              <a className={'link-github'} href={DFArchonLinks.github}>
                <span className={'icon-github'}></span>
              </a>

              <Spacer width={4} />
              <Link to={DFArchonLinks.plugins}>plugins</Link>
              <Spacer width={4} />
              <Link to={DFArchonLinks.wiki}>wiki</Link>
            </LinkContainer> */}

            <OnlyMobile>
              <Spacer height={4} />
            </OnlyMobile>
            <HideOnMobile>
              <Spacer height={12} />
            </HideOnMobile>

            {/* <Spacer height={6} /> */}

            <PreTitle>
              <LinkContainer>
                <a className={'link'} href={DFArchonLinks.guide} target='_blank' rel='noreferrer'>
                  <div>
                    <span style={{ fontSize: '50px' }}>
                      <Round3Title>Dark Forest Adventure Round</Round3Title>
                    </span>
                    <br />
                    <span style={{ fontSize: '20px' }}>
                      <Round3Title> held by AGLD DAO </Round3Title>
                    </span>
                  </div>

                  <div style={{ fontSize: '40px' }}></div>
                </a>
              </LinkContainer>
            </PreTitle>

            {/* <div style={{ fontSize: '30px' }}>
              <Round3Title>NOW I AM BECOME DEATH</Round3Title>
            </div>

            <div style={{ fontSize: '50px' }}> THE DESTROYER OF WORLDS</div> */}

            <LandingPageRoundArt />

            <SubTitle>
              <div style={{ fontSize: '30px', color: '#05fe1a' }}>
                <Round3Title> Dark Forest Community Round</Round3Title>
              </div>

              <div style={{ fontSize: '30px', color: 'white' }}>
                <Round3Title> Adventure Layer </Round3Title>
              </div>

              <Spacer height={48} />

              <LinkContainer>
                <a className={'link'} href={DFArchonLinks.twitter} target='_blank' rel='noreferrer'>
                  Twitter
                </a>
                <Spacer width={6} />
                <a className={'link'} href={DFArchonLinks.discord} target='_blank' rel='noreferrer'>
                  Discord
                </a>
                <Spacer width={6} />
                <a className={'link'} href={DFArchonLinks.guide} target='_blank' rel='noreferrer'>
                  Guide
                </a>
              </LinkContainer>
            </SubTitle>

            {/*
            <p>
              <White>Dark Forest</White> <Text>zkSNARK space warfare</Text>
              <br />
              <Text>Round 5: </Text>
              <White>The Junk Wars</White>
            </p> */}

            {/* <Spacer height={20} /> */}

            {/* <p>
             <White>DF ARES v0.1 </White> <Text> </Text>
             <br />
              <Text>Round 1: </Text>
              <White>Artifact Combat</White>
            </p> */}

            {/* <Spacer height={16} /> */}

            {/* <ButtonWrapper>
              <Btn size='large' onClick={() => history.push(`/lobby/${defaultAddress}`)}>
                Create Lobby
              </Btn>
              <Btn size='large' onClick={() => history.push(`/play/${defaultAddress}`)}>
                Enter Round 1
              </Btn>
              <Btn size='large' onClick={() => history.push(`/events`)}>
                Events
              </Btn>
            </ButtonWrapper> */}
          </Header>
          {/* <EmSpacer height={3} />
          Ways to get Involved
          <EmSpacer height={1} /> */}
          {/* <Involved>
            <InvolvedItem
              href='https://blog.zkga.me/hosting-a-dark-forest-community-round'
              style={{
                backgroundImage: "url('/public/get_involved/community_round.png')",
              }}
            ></InvolvedItem>
            <InvolvedItem
              href='https://github.com/darkforest-eth/plugins#adding-your-plugin'
              style={{
                backgroundImage: "url('/public/get_involved/write_plugin.png')",
              }}
            ></InvolvedItem>
            <InvolvedItem
              href='https://github.com/darkforest-eth/plugins#reviewer-guidelines'
              style={{
                backgroundImage: "url('/public/get_involved/reveiw_plugin.png')",
              }}
            ></InvolvedItem>
            <InvolvedItem
              href='https://blog.zkga.me/renderer-plugin-contest'
              style={{
                backgroundImage: "url('/public/get_involved/plugin_render.png')",
              }}
            ></InvolvedItem>
            <InvolvedItem
              href='https://blog.zkga.me/introducing-dark-forest-lobbies'
              style={{
                backgroundImage: "url('/public/get_involved/lobby.png')",
              }}
            ></InvolvedItem>
          </Involved> */}
          {/* <EmSpacer height={3} /> */}
          {/* <HallOfFame style={{ color: dfstyles.colors.text }}>
            <HallOfFameTitle>Space Masters</HallOfFameTitle>
            <Spacer height={8} />
            <table>
              <tbody>
                <TRow>
                  <td>
                    <HideSmall>v</HideSmall>0.1
                  </td>
                  <td>
                    02/22/<HideSmall>20</HideSmall>20
                  </td>
                  <td>
                    <a href='https://twitter.com/zoink'>Dylan Field</a>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <HideSmall>v</HideSmall>0.2
                  </td>
                  <td>
                    06/24/<HideSmall>20</HideSmall>20
                  </td>
                  <td>Nate Foss</td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v3-rules'>
                      <HideSmall>v</HideSmall>0.3
                    </Link>
                  </td>
                  <td>
                    08/07/<HideSmall>20</HideSmall>20
                  </td>
                  <td>
                    <Link to='https://twitter.com/hideandcleanse'>@hideandcleanse</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v4-recap'>
                      <HideSmall>v</HideSmall>0.4
                    </Link>
                  </td>
                  <td>
                    10/02/<HideSmall>20</HideSmall>20
                  </td>
                  <td>
                    <Link to='https://twitter.com/jacobrosenthal'>Jacob Rosenthal</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v5-winners'>
                      <HideSmall>v</HideSmall>0.5
                    </Link>
                  </td>
                  <td>
                    12/25/<HideSmall>20</HideSmall>20
                  </td>
                  <td>0xb05d9542...</td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v6-r1-wrapup'>
                      <HideSmall>v</HideSmall>0.6 round 1
                    </Link>
                  </td>
                  <td>
                    05/22/<HideSmall>20</HideSmall>21
                  </td>
                  <td>
                    <Link to='https://twitter.com/adietrichs'>Ansgar Dietrichs</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v6-r2-wrapup'>
                      <HideSmall>v</HideSmall>0.6 round 2
                    </Link>
                  </td>
                  <td>
                    07/07/<HideSmall>20</HideSmall>21
                  </td>
                  <td>
                    <Link to='https://twitter.com/orden_gg'>@orden_gg</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v6-r3-wrapup'>
                      <HideSmall>v</HideSmall>0.6 round 3
                    </Link>
                  </td>
                  <td>
                    08/22/<HideSmall>20</HideSmall>21
                  </td>
                  <td>
                    <Link to='https://twitter.com/dropswap_gg'>@dropswap_gg</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v6-r4-wrapup'>
                      <HideSmall>v</HideSmall>0.6 round 4
                    </Link>
                  </td>
                  <td>
                    10/01/<HideSmall>20</HideSmall>21
                  </td>
                  <td>
                    <Link to='https://twitter.com/orden_gg'>@orden_gg</Link>
                  </td>
                </TRow>
                <TRow>
                  <td>
                    <Link to='https://blog.zkga.me/v6-r5-wrapup'>
                      <HideSmall>v</HideSmall>0.6 round 5
                    </Link>
                  </td>
                  <td>
                    02/18/<HideSmall>20</HideSmall>22
                  </td>
                  <td>
                    <Link to='https://twitter.com/d_fdao'>@d_fdao</Link>
                    {' + '}
                    <Link to='https://twitter.com/orden_gg'>@orden_gg</Link>
                  </td>
                </TRow>
              </tbody>
            </table>
          </HallOfFame> */}
          <Spacer height={32} />
          {/* <EmailWrapper>
            <EmailCTA mode={EmailCTAMode.SUBSCRIBE} />
          </EmailWrapper> */}
        </MainContentContainer>

        {/* <Spacer height={128} />

        <LeadboardDisplay />

        <Spacer height={256} /> */}
      </Page>
    </>
  );
}

const Round3Title = styled.span`
  font-family: 'Start Press 2P', sans-serif;
`;

const PreTitle = styled.div`
  width: 1000px;
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const SubTitle = styled.div`
  width: 1000px;
  position: absolute;
  top: 80%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const PrettyOverlayGradient = styled.div`
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to left top, rgba(74, 74, 74, 0.628), rgba(60, 1, 255, 0.2)) fixed;
  background-position: 50%, 50%;
  display: inline-block;
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
`;

const Header = styled.div`
  text-align: center;
`;

const EmailWrapper = styled.div`
  display: flex;
  flex-direction: row;
`;

const TRow = styled.tr`
  & td:first-child {
    color: ${dfstyles.colors.subtext};
  }
  & td:nth-child(2) {
    padding-left: 12pt;
  }
  & td:nth-child(3) {
    text-align: right;
    padding-left: 16pt;
  }
`;

const MainContentContainer = styled.div`
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
`;

const Page = styled.div`
  position: absolute;
  width: 100vw;
  max-width: 100vw;
  height: 100%;
  color: white;
  /* background-color: #ffb4c1; */
  background-color: 'black';
  font-size: ${dfstyles.fontSize};
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: ${LandingPageZIndex.BasePage};
  background-image: url('/public/background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  /* background-position: 1%; */
`;

const HallOfFameTitle = styled.div`
  color: ${dfstyles.colors.subtext};
  display: inline-block;
  border-bottom: 1px solid ${dfstyles.colors.subtext};
  line-height: 1em;
`;

export const LinkContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  /* margin-top: 130pt; */
  font-family: 'Start Press 2P', sans-serif;

  a {
    margin: 0 6pt;
    transition: color 0.2s;
    display: flex;
    justify-content: center;
    align-items: center;
    color:  ${'#ffc3cd'};
    font-family: 'Start Press 2P', sans-serif;

    &:hover {
      cursor: pointer;
      &.link-twitter {
        color: ${dfstyles.colors.icons.twitter};
      }
      &.link-github {
        color: ${dfstyles.colors.icons.github};
      }
      &.link-discord {
        color: ${dfstyles.colors.icons.discord};
      }
      &.link-blog {
        color: ${dfstyles.colors.icons.blog};
      }
      &.link-email {
        color: ${dfstyles.colors.icons.email};
      }
      &.link{
        /* color: ${dfstyles.colors.dfpink}; */
        color:${'white'}
        /* font-weight: bolder; */

      }
      }
    }
  }
`;

function Hiring() {
  return (
    <HideOnMobile>
      <Modal contain={['top', 'left', 'right']} initialX={50} initialY={50}>
        <Title slot='title'>Dark Forest is Hiring!</Title>
        <div style={{ maxWidth: '300px', textAlign: 'justify' }}>
          We are looking for experienced full stack and solidity developers to join our team! If you
          like what you see,{' '}
          <Link to='https://docs.google.com/forms/d/e/1FAIpQLSdaWvjxX4TrDDLidPXtgk6UW3rC082rpvi3AIPkCPxAahg_rg/viewform?usp=sf_link'>
            consider applying
          </Link>
          . If you know someone who you think would be a great fit for our team,{' '}
          <Link to='https://docs.google.com/forms/d/e/1FAIpQLScku_bQDbkPqpHrwBzOBfQ4SV6Nw6Tgxi6zWQL8Bb0olyBE3w/viewform?usp=sf_link'>
            please refer them here
          </Link>
          .
          <br />
          <br />
          Learn more about the role{' '}
          <Link to='https://ivanchub.notion.site/Dark-Forest-is-Hiring-ad1f0cbe816640fb9b4c663dacaaca04'>
            here
          </Link>
          .
        </div>
      </Modal>
    </HideOnMobile>
  );
}

const HideOnMobile = styled.div`
  @media only screen and (max-device-width: 1000px) {
    display: none;
  }
`;

const OnlyMobile = styled.div`
  @media only screen and (min-device-width: 1000px) {
    display: none;
  }
`;

const Involved = styled.div`
  width: 100%;
  padding-left: 16px;
  padding-right: 16px;
  display: grid;
  grid-template-columns: auto auto;
  gap: 10px;
  grid-auto-rows: minmax(100px, auto);

  @media only screen and (max-device-width: 1000px) {
    grid-template-columns: auto;
  }
`;

const InvolvedItem = styled.a`
  height: 150px;
  display: inline-block;
  margin: 4px;
  padding: 4px 8px;

  background-color: ${dfstyles.colors.backgroundlighter};
  background-size: cover;
  background-position: 50% 50%;
  background-repeat: no-repeat;

  cursor: pointer;
  transition: transform 200ms;
  &:hover {
    transform: scale(1.03);
  }
  &:hover:active {
    transform: scale(1.05);
  }
`;

const HallOfFame = styled.div`
  @media only screen and (max-device-width: 1000px) {
    font-size: 70%;
  }
`;
