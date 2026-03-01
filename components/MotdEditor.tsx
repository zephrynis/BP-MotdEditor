import React from "react";
import { useState } from "react";
import tw from 'twin.macro';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import TitledGreyBox from "@/components/elements/TitledGreyBox";
import Input, {Textarea} from "@/components/elements/Input";
import MotdDisplay from "./MotdDisplay"
import { ServerContext } from '@/state/server';
import getFileContents from '@/api/server/files/getFileContents';

export default () => {
    // const uuid = ServerContext.useStoreState(state => state.server.data?.uuid);
    const server = ServerContext.useStoreState((state) => state.server.data!);
    const [lineOne, setLineOne] = useState("");
    const [lineTwo, setLineTwo] = useState("");
    // const [properties, setProperties] = useState("");

    const textAreaChange = (e) => {
      const newValue = e.target.value;
      const lines = newValue.split('\n');
      if (lines.length <= 2) {
        setLineOne(lines[0]);
        setLineTwo(lines[1]);
      }
    };

    // const getProperties = async () => {
    //   if (!uuid) return;
    //   const content = await getFileContents(uuid, '/server.properties');
    //   console.log(content);
    //   setProperties(content);
    // }

    // getProperties()

    return (
      <ServerContentBlock title={'Test'}>
        <div css={tw`md:flex`}>
          <div css={tw`flex-1`}>
            <TitledGreyBox title={'Editor'}>
              {/*<input onChange={e => setText(e.target.value)}></input>*/}
              {/*<Input onChange={e => setLineOne(e.target.value)} />
              <Input onChange={e => setLineTwo(e.target.value)} />*/}
              <Textarea value={lineOne + (lineTwo ? ("\n" + lineTwo) : "")} onChange={textAreaChange} rows={2} />
            </TitledGreyBox>
          </div>
          <div css={tw`flex-1 lg:flex-none lg:w-1/2 mt-8 md:mt-0 md:ml-10`}>
            <TitledGreyBox title={'Preview'}>
              <div css={tw`w-full flex`}>
                <MotdDisplay title={server.name} lineOne={lineOne || ""} lineTwo={lineTwo || ""} />
              </div>
            </TitledGreyBox>
          </div>
        </div>
      </ServerContentBlock>
    );
};
