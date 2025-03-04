import Error from 'next/error';
import { JSX } from 'react/jsx-runtime';

type NotFoundProps = {
  message?: string;
};

export default function NotFound({ message }: NotFoundProps): JSX.Element {
  return <div className='flex gap-2 divide-x justify-center my-60 text-2xl '>
      <div>
        <h1>404</h1>
      </div>
      <div>
        <h1 className='mx-2'>tem nada aqui pae</h1>
      </div>
    </div>
}
